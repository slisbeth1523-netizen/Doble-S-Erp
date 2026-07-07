import sql from "mssql";

import { getSqlConfig } from "./local-env.mjs";

const apiUrl = normalizeUrl(process.env.SMOKE_API_URL ?? process.env.VITE_API_URL ?? "http://localhost:4001/api");
const demoEmail = process.env.SMOKE_DEMO_EMAIL ?? process.env.VITE_DEMO_EMAIL ?? "demo@dobles.local";
const demoPassword = process.env.SMOKE_DEMO_PASSWORD ?? process.env.VITE_DEMO_PASSWORD ?? "Demo12345!";

const requiredCatalogs = [
  { code: "customers", seedCode: "CLI-DEMO" },
  { code: "suppliers", seedCode: "SUP-DEMO" },
  { code: "items", seedCode: "ART-DEMO" },
  { code: "categories", seedCode: "GENERAL" },
  { code: "brands", seedCode: "DOBLES" },
  { code: "units-of-measure", seedCode: "UND" },
  { code: "warehouses", seedCode: "ALM-PRINCIPAL" },
  { code: "inventory-stocks", seedCode: "ART-DEMO" }
];

const smokeRun = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

function normalizeUrl(value) {
  return value.replace(/\/$/, "");
}

function smokeStep(label) {
  console.log(`smoke: ${label}`);
}

function fail(message) {
  throw new Error(message);
}

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers ?? {})
      }
    });
  } catch (error) {
    fail(`API unavailable at ${apiUrl}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  return { response, body };
}

async function expectOk(path, options = {}) {
  const result = await request(path, options);

  if (!result.response.ok || result.body?.success === false) {
    fail(
      `${path} failed with HTTP ${result.response.status}: ${JSON.stringify(result.body ?? {})}`
    );
  }

  return result.body;
}

function authHeaders(session) {
  return {
    authorization: `Bearer ${session.accessToken}`,
    "x-tenant-id": session.user.tenantId,
    ...(session.user.companyId ? { "x-company-id": session.user.companyId } : {})
  };
}

async function createCatalogRecord(catalog, payload, session) {
  const body = await expectOk(`/master-data/${catalog}`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function updateCatalogRecord(catalog, id, payload, session) {
  const body = await expectOk(`/master-data/${catalog}/${id}`, {
    method: "PUT",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function setCatalogRecordActive(catalog, id, active, session) {
  const path = active
    ? `/master-data/${catalog}/${id}/activate`
    : `/master-data/${catalog}/${id}/deactivate`;
  const body = await expectOk(path, {
    method: "PATCH",
    headers: authHeaders(session)
  });

  return body.data;
}

async function findCatalogRecord(catalog, search, session) {
  const body = await expectOk(
    `/master-data/${catalog}?search=${encodeURIComponent(search)}&page=1&pageSize=10`,
    { headers: authHeaders(session) }
  );

  return (body.data ?? []).find((item) => item.code === search);
}

async function ensureZeroStockRecord(session, item, warehouse) {
  if (!session.user.companyId) {
    fail("Cannot create QA stock without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("ItemId", sql.UniqueIdentifier, item.id)
      .input("WarehouseId", sql.UniqueIdentifier, warehouse.id)
      .input("UserId", sql.UniqueIdentifier, session.user.userId ?? null)
      .query(`
        IF NOT EXISTS (
          SELECT 1
          FROM inventory.ItemStocks
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND ItemId = @ItemId
            AND WarehouseId = @WarehouseId
        )
        BEGIN
          INSERT INTO inventory.ItemStocks (
            TenantId, CompanyId, ItemId, WarehouseId, QuantityOnHand,
            QuantityReserved, AverageCost, LastCost, StandardCost, IsActive, CreatedBy
          )
          VALUES (
            @TenantId, @CompanyId, @ItemId, @WarehouseId, 0,
            0, 0, 0, 0, 1, @UserId
          );
        END;
      `);
  } finally {
    await pool.close();
  }
}

async function validateBackendBasics() {
  smokeStep("GET /health");
  await expectOk("/health");

  smokeStep("GET /version");
  await expectOk("/version");

  smokeStep("GET /health/db");
  const dbHealth = await request("/health/db");

  if (dbHealth.response.status === 503) {
    fail(
      `SQL Server unavailable for smoke: ${JSON.stringify(dbHealth.body ?? {})}. Run npm run db:setup with a reachable local SQL Server before npm run smoke:local.`
    );
  }

  if (!dbHealth.response.ok || dbHealth.body?.success === false) {
    fail(`/health/db failed with HTTP ${dbHealth.response.status}: ${JSON.stringify(dbHealth.body ?? {})}`);
  }
}

async function loginDemo() {
  smokeStep("POST /auth/login demo");
  const body = await expectOk("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: demoEmail, password: demoPassword })
  });

  const session = body.data;

  if (!session?.accessToken || !session.user?.tenantId) {
    fail("Demo login did not return an access token and tenant context.");
  }

  smokeStep("GET /auth/me");
  await expectOk("/auth/me", { headers: authHeaders(session) });

  return session;
}

async function validateCatalogs(session) {
  for (const catalog of requiredCatalogs) {
    smokeStep(`metadata ${catalog.code}`);
    const metadata = await expectOk(`/master-data/${catalog.code}/metadata`, {
      headers: authHeaders(session)
    });

    if (!metadata.data?.fields?.length) {
      fail(`${catalog.code} metadata did not include fields.`);
    }

    smokeStep(`list ${catalog.code}`);
    const list = await expectOk(
      `/master-data/${catalog.code}?search=${encodeURIComponent(catalog.seedCode)}&page=1&pageSize=10`,
      { headers: authHeaders(session) }
    );

    const seedRecord = (list.data ?? []).find((item) => item.code === catalog.seedCode);

    if (!seedRecord) {
      fail(`${catalog.code} seed record ${catalog.seedCode} was not returned by the API.`);
    }

    if (catalog.code === "units-of-measure") {
      const fields = metadata.data.fields.map((field) => field.field);
      const missingFields = ["symbol", "unitType", "decimalPrecision", "isBaseUnit"].filter(
        (field) => !fields.includes(field)
      );

      if (missingFields.length) {
        fail(`units-of-measure metadata is missing fields: ${missingFields.join(", ")}.`);
      }
    }

    if (catalog.code === "items") {
      const unitField = metadata.data.fields.find((field) => field.field === "unitOfMeasureId");
      const warehouseField = metadata.data.fields.find((field) => field.field === "defaultWarehouseId");

      if (unitField?.lookupCatalog !== "units-of-measure") {
        fail("items metadata did not keep unitOfMeasureId lookupCatalog=units-of-measure.");
      }

      if (warehouseField?.lookupCatalog !== "warehouses") {
        fail("items metadata did not keep defaultWarehouseId lookupCatalog=warehouses.");
      }
    }

    if (catalog.code === "warehouses") {
      const fields = metadata.data.fields.map((field) => field.field);
      const missingFields = [
        "warehouseType",
        "addressLine1",
        "addressLine2",
        "city",
        "province",
        "countryCode",
        "responsibleUserId",
        "allowsNegativeInventory",
        "isDefault",
        "isTransit",
        "isVirtual"
      ].filter((field) => !fields.includes(field));

      if (missingFields.length) {
        fail(`warehouses metadata is missing fields: ${missingFields.join(", ")}.`);
      }
    }

    if (catalog.code === "inventory-stocks") {
      const fields = metadata.data.fields.map((field) => field.field);
      const missingFields = [
        "itemCode",
        "itemDescription",
        "warehouseCode",
        "warehouseName",
        "quantityOnHand",
        "quantityReserved",
        "quantityAvailable",
        "averageCost",
        "lastCost",
        "standardCost",
        "lastMovementAt",
        "isActive"
      ].filter((field) => !fields.includes(field));

      if (missingFields.length) {
        fail(`inventory-stocks metadata is missing fields: ${missingFields.join(", ")}.`);
      }

      if (metadata.data.catalog.readOnly !== true) {
        fail("inventory-stocks metadata did not report readOnly=true.");
      }

      const createAction = metadata.data.actions.find((action) => action.action === "create");

      if (createAction?.available !== false) {
        fail("inventory-stocks create action must be unavailable.");
      }

      const available = Number(seedRecord.quantityAvailable ?? 0);
      const onHand = Number(seedRecord.quantityOnHand ?? 0);
      const reserved = Number(seedRecord.quantityReserved ?? 0);

      if (available !== onHand - reserved) {
        fail("inventory-stocks QuantityAvailable did not match QuantityOnHand - QuantityReserved.");
      }
    }
  }
}

async function validateCrud(session) {
  const suffix = smokeRun;
  const customerCode = `QA-CUST-${suffix}`;
  const categoryCode = `QA-CAT-${suffix}`;
  const brandCode = `QA-BRD-${suffix}`;
  const unitCode = `QA-UOM-${suffix}`;
  const warehouseCode = `QA-WHS-${suffix}`;
  const itemCode = `QA-ITEM-${suffix}`;

  smokeStep("CRUD customer create");
  const customer = await createCatalogRecord(
    "customers",
    {
      code: customerCode,
      name: "Cliente QA Runtime",
      commercialName: "Cliente QA",
      documentType: "RNC",
      documentNumber: `QA${suffix}`,
      email: "qa.runtime@dobles.local",
      phone: "809-000-0100",
      city: "Santo Domingo",
      province: "Distrito Nacional",
      countryCode: "DOM",
      creditLimit: 1000,
      isCreditCustomer: true,
      isActive: true
    },
    session
  );

  smokeStep("CRUD customer update");
  await updateCatalogRecord(
    "customers",
    customer.id,
    {
      code: customerCode,
      name: "Cliente QA Runtime Editado",
      commercialName: "Cliente QA",
      documentType: "RNC",
      documentNumber: `QA${suffix}`,
      email: "qa.runtime@dobles.local",
      phone: "809-000-0100",
      city: "Santo Domingo",
      province: "Distrito Nacional",
      countryCode: "DOM",
      creditLimit: 1500,
      isCreditCustomer: true,
      isActive: true
    },
    session
  );

  smokeStep("CRUD customer deactivate/reactivate");
  await setCatalogRecordActive("customers", customer.id, false, session);
  await setCatalogRecordActive("customers", customer.id, true, session);

  smokeStep("CRUD customer search");
  const foundCustomer = await findCatalogRecord("customers", customerCode, session);

  if (!foundCustomer) {
    fail(`Created customer ${customerCode} was not found by search.`);
  }

  smokeStep("CRUD category create");
  const category = await createCatalogRecord(
    "categories",
    {
      code: categoryCode,
      name: "Categoria QA Runtime",
      description: "Categoria creada por smoke local",
      isSalesCategory: true,
      isPurchaseCategory: true,
      isInventoryCategory: true,
      isActive: true
    },
    session
  );

  smokeStep("CRUD brand create");
  const brand = await createCatalogRecord(
    "brands",
    {
      code: brandCode,
      name: "Marca QA Runtime",
      description: "Marca creada por smoke local",
      website: "https://local.dobles.example",
      countryCode: "DOM",
      isActive: true
    },
    session
  );

  smokeStep("CRUD unit of measure create");
  const unit = await createCatalogRecord(
    "units-of-measure",
    {
      code: unitCode,
      name: "Unidad QA Runtime",
      description: "Unidad creada por smoke local",
      symbol: "qa",
      unitType: "QUANTITY",
      decimalPrecision: 0,
      isBaseUnit: false,
      isActive: true
    },
    session
  );

  smokeStep("CRUD unit of measure search");
  const foundUnit = await findCatalogRecord("units-of-measure", unitCode, session);

  if (!foundUnit) {
    fail(`Created unit of measure ${unitCode} was not found by search.`);
  }

  smokeStep("CRUD warehouse create");
  const warehouse = await createCatalogRecord(
    "warehouses",
    {
      code: warehouseCode,
      name: "Almacen QA Runtime",
      description: "Almacen creado por smoke local",
      warehouseType: "NORMAL",
      addressLine1: "Calle QA 1",
      addressLine2: "Nave QA",
      city: "Santo Domingo",
      province: "Distrito Nacional",
      countryCode: "DOM",
      responsibleUserId: null,
      allowsNegativeInventory: false,
      isDefault: false,
      isTransit: false,
      isVirtual: false,
      isActive: true
    },
    session
  );

  smokeStep("CRUD warehouse search");
  const foundWarehouse = await findCatalogRecord("warehouses", warehouseCode, session);

  if (!foundWarehouse) {
    fail(`Created warehouse ${warehouseCode} was not found by search.`);
  }

  smokeStep("CRUD item create");
  const item = await createCatalogRecord(
    "items",
    {
      code: itemCode,
      name: "Articulo QA Runtime",
      shortDescription: "Articulo QA",
      barcode: `779${suffix}`,
      alternateCode: `ALT-${itemCode}`,
      categoryId: category.id,
      brandId: brand.id,
      unitOfMeasureId: unit.id,
      defaultWarehouseId: warehouse.id,
      inventoryType: "PRODUCT",
      itemType: "NORMAL",
      allowNegativeInventory: false,
      trackInventory: true,
      trackLot: false,
      trackSerial: false,
      isService: false,
      isManufactured: false,
      costMethod: "AVERAGE",
      standardCost: 10,
      averageCost: 10,
      lastCost: 10,
      basePrice: 15,
      minimumPrice: 12,
      maximumDiscountPercent: 0,
      weight: 0,
      volume: 0,
      notes: "Articulo creado por smoke local",
      isActive: true
    },
    session
  );

  smokeStep("inventory stock zero create");
  await ensureZeroStockRecord(session, item, warehouse);

  smokeStep("inventory stock zero search");
  const foundStock = await findCatalogRecord("inventory-stocks", itemCode, session);

  if (!foundStock) {
    fail(`Created inventory stock for ${itemCode} was not found by search.`);
  }

  const stockAvailable = Number(foundStock.quantityAvailable ?? 0);
  const stockOnHand = Number(foundStock.quantityOnHand ?? 0);
  const stockReserved = Number(foundStock.quantityReserved ?? 0);

  if (stockOnHand !== 0 || stockReserved !== 0 || stockAvailable !== 0) {
    fail(`Created inventory stock for ${itemCode} was not seeded with zero quantities.`);
  }

  if (stockAvailable !== stockOnHand - stockReserved) {
    fail(`Created inventory stock for ${itemCode} has an invalid available quantity.`);
  }
}

async function main() {
  console.log(`smoke: API ${apiUrl}`);
  await validateBackendBasics();
  const session = await loginDemo();
  await validateCatalogs(session);
  await validateCrud(session);
  console.log("smoke: local runtime validation OK");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
