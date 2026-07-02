const apiUrl = normalizeUrl(process.env.SMOKE_API_URL ?? process.env.VITE_API_URL ?? "http://localhost:4001/api");
const demoEmail = process.env.SMOKE_DEMO_EMAIL ?? process.env.VITE_DEMO_EMAIL ?? "demo@dobles.local";
const demoPassword = process.env.SMOKE_DEMO_PASSWORD ?? process.env.VITE_DEMO_PASSWORD ?? "Demo12345!";

const requiredCatalogs = [
  { code: "customers", seedCode: "CLI-DEMO" },
  { code: "suppliers", seedCode: "SUP-DEMO" },
  { code: "items", seedCode: "ART-DEMO" },
  { code: "categories", seedCode: "GENERAL" },
  { code: "brands", seedCode: "DOBLES" }
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
  }
}

async function validateCrud(session) {
  const suffix = smokeRun;
  const customerCode = `QA-CUST-${suffix}`;
  const categoryCode = `QA-CAT-${suffix}`;
  const brandCode = `QA-BRD-${suffix}`;
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

  smokeStep("CRUD item create");
  await createCatalogRecord(
    "items",
    {
      code: itemCode,
      name: "Articulo QA Runtime",
      shortDescription: "Articulo QA",
      barcode: `779${suffix}`,
      alternateCode: `ALT-${itemCode}`,
      categoryId: category.id,
      brandId: brand.id,
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
