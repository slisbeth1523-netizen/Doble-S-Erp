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
  { code: "inventory-stocks", seedCode: "ART-DEMO" },
  { code: "inventory-movements", seedCode: "MOV-DEMO-001" },
  { code: "inventory-movement-lines", seedCode: "MOV-DEMO-001" }
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

async function postInventoryMovement(movementId, session) {
  const body = await expectOk(`/inventory/movements/${movementId}/post`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function createInventoryAdjustment(payload, session) {
  const body = await expectOk("/inventory/adjustments", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function createPhysicalCount(payload, session) {
  const body = await expectOk("/inventory/physical-counts", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function addPhysicalCountLine(physicalCountId, payload, session) {
  const body = await expectOk(`/inventory/physical-counts/${physicalCountId}/lines`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function completePhysicalCount(physicalCountId, session) {
  const body = await expectOk(`/inventory/physical-counts/${physicalCountId}/complete`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function createPhysicalCountAdjustment(physicalCountId, session) {
  const body = await expectOk(`/inventory/physical-counts/${physicalCountId}/create-adjustment`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function createPurchaseOrder(payload, session) {
  const body = await expectOk("/purchasing/purchase-orders", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function approvePurchaseOrder(purchaseOrderId, session) {
  const body = await expectOk(`/purchasing/purchase-orders/${purchaseOrderId}/approve`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function cancelPurchaseOrder(purchaseOrderId, reason, session) {
  const body = await expectOk(`/purchasing/purchase-orders/${purchaseOrderId}/cancel`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({ reason })
  });

  return body.data;
}

async function createPurchaseReceipt(payload, session) {
  const body = await expectOk("/purchasing/purchase-receipts", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function addPurchaseReceiptLine(purchaseReceiptId, payload, session) {
  const body = await expectOk(`/purchasing/purchase-receipts/${purchaseReceiptId}/lines`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function completePurchaseReceipt(purchaseReceiptId, session) {
  const body = await expectOk(`/purchasing/purchase-receipts/${purchaseReceiptId}/complete`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function createSupplierInvoice(payload, session) {
  const body = await expectOk("/purchasing/supplier-invoices", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function addSupplierInvoiceLine(supplierInvoiceId, payload, session) {
  const body = await expectOk(`/purchasing/supplier-invoices/${supplierInvoiceId}/lines`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function completeSupplierInvoice(supplierInvoiceId, session) {
  const body = await expectOk(`/purchasing/supplier-invoices/${supplierInvoiceId}/complete`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function expectSupplierInvoiceCompleteFailure(supplierInvoiceId, session) {
  const result = await request(`/purchasing/supplier-invoices/${supplierInvoiceId}/complete`, {
    method: "POST",
    headers: authHeaders(session)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Re-posting supplier invoice for ${supplierInvoiceId} must fail in a controlled way.`);
  }

  return result.body;
}

async function expectPhysicalCountAdjustmentFailure(physicalCountId, session) {
  const result = await request(`/inventory/physical-counts/${physicalCountId}/create-adjustment`, {
    method: "POST",
    headers: authHeaders(session)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Recreating physical count adjustment for ${physicalCountId} must fail in a controlled way.`);
  }

  return result.body;
}

async function expectPurchaseReceiptCompleteFailure(purchaseReceiptId, session) {
  const result = await request(`/purchasing/purchase-receipts/${purchaseReceiptId}/complete`, {
    method: "POST",
    headers: authHeaders(session)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Reposting purchase receipt ${purchaseReceiptId} must fail in a controlled way.`);
  }

  return result.body;
}

async function expectInventoryMovementPostFailure(movementId, session) {
  const result = await request(`/inventory/movements/${movementId}/post`, {
    method: "POST",
    headers: authHeaders(session)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Reposting inventory movement ${movementId} must fail in a controlled way.`);
  }

  return result.body;
}

async function findCatalogRecord(catalog, search, session) {
  const body = await expectOk(
    `/master-data/${catalog}?search=${encodeURIComponent(search)}&page=1&pageSize=10`,
    { headers: authHeaders(session) }
  );

  return (body.data ?? []).find((item) => item.code === search);
}

async function findInventoryStockRuntimeRecord(session, itemCode, warehouseCode) {
  const body = await expectOk(
    `/master-data/inventory-stocks?search=${encodeURIComponent(itemCode)}&page=1&pageSize=50`,
    { headers: authHeaders(session) }
  );

  return (body.data ?? []).find(
    (item) => item.itemCode === itemCode && item.warehouseCode === warehouseCode
  );
}

async function findInventoryLedgerRuntimeRecords(session, movementNumber) {
  const body = await expectOk(
    `/master-data/inventory-ledger?search=${encodeURIComponent(movementNumber)}&page=1&pageSize=20`,
    { headers: authHeaders(session) }
  );

  return (body.data ?? []).filter((item) => item.movementNumber === movementNumber);
}

async function getStockSnapshot(session, itemCode, warehouseCode) {
  const snapshot = await getOptionalStockSnapshot(session, itemCode, warehouseCode);

  if (!snapshot) {
    fail(`Inventory stock ${itemCode} + ${warehouseCode} was not found.`);
  }

  return snapshot;
}

async function getOptionalStockSnapshot(session, itemCode, warehouseCode) {
  if (!session.user.companyId) {
    fail("Cannot validate stock without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("ItemCode", sql.NVarChar(80), itemCode)
      .input("WarehouseCode", sql.NVarChar(80), warehouseCode)
      .query(`
        SELECT
          stock.QuantityOnHand,
          stock.QuantityReserved,
          stock.QuantityAvailable,
          stock.AverageCost,
          stock.LastCost,
          stock.LastMovementAt
        FROM inventory.ItemStocks stock
        INNER JOIN inventory.Items item
          ON item.ItemId = stock.ItemId
        INNER JOIN inventory.Warehouses warehouse
          ON warehouse.WarehouseId = stock.WarehouseId
        WHERE stock.TenantId = @TenantId
          AND stock.CompanyId = @CompanyId
          AND item.Code = @ItemCode
          AND warehouse.Code = @WarehouseCode;
      `);

    const row = result.recordset[0];

    if (!row) {
      return null;
    }

    return {
      quantityOnHand: Number(row.QuantityOnHand ?? 0),
      quantityReserved: Number(row.QuantityReserved ?? 0),
      quantityAvailable: Number(row.QuantityAvailable ?? 0),
      averageCost: Number(row.AverageCost ?? 0),
      lastCost: Number(row.LastCost ?? 0),
      lastMovementAt: row.LastMovementAt
    };
  } finally {
    await pool.close();
  }
}

async function getInventoryLedgerEntries(session, movementNumber) {
  if (!session.user.companyId) {
    fail("Cannot validate inventory ledger without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("MovementNumber", sql.NVarChar(40), movementNumber)
      .query(`
        SELECT
          MovementNumber,
          MovementType,
          LedgerDirection,
          WarehouseCode,
          QuantityIn,
          QuantityOut,
          QuantityBalanceImpact
        FROM inventory.V_InventoryLedger
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND MovementNumber = @MovementNumber
        ORDER BY LedgerDirection, WarehouseCode;
      `);

    return result.recordset.map((row) => ({
      movementNumber: row.MovementNumber,
      movementType: row.MovementType,
      ledgerDirection: row.LedgerDirection,
      warehouseCode: row.WarehouseCode,
      quantityIn: Number(row.QuantityIn ?? 0),
      quantityOut: Number(row.QuantityOut ?? 0),
      quantityBalanceImpact: Number(row.QuantityBalanceImpact ?? 0)
    }));
  } finally {
    await pool.close();
  }
}

async function assertInventoryLedgerEntries(session, movementNumber, expectedEntries) {
  const entries = await getInventoryLedgerEntries(session, movementNumber);

  if (entries.length !== expectedEntries.length) {
    fail(`Inventory ledger for ${movementNumber} expected ${expectedEntries.length} entries but found ${entries.length}.`);
  }

  for (const expected of expectedEntries) {
    const found = entries.find(
      (entry) =>
        entry.movementType === expected.movementType &&
        entry.ledgerDirection === expected.ledgerDirection &&
        entry.warehouseCode === expected.warehouseCode &&
        entry.quantityIn === expected.quantityIn &&
        entry.quantityOut === expected.quantityOut &&
        entry.quantityBalanceImpact === expected.quantityBalanceImpact
    );

    if (!found) {
      fail(`Inventory ledger for ${movementNumber} did not include ${JSON.stringify(expected)}.`);
    }
  }

  const runtimeEntries = await findInventoryLedgerRuntimeRecords(session, movementNumber);

  if (runtimeEntries.length !== expectedEntries.length) {
    fail(`/master-data/inventory-ledger did not return ${expectedEntries.length} entries for ${movementNumber}.`);
  }
}

async function createQaPostableMovement(session, movementNumber, quantity, unitCost, movementType = "ADJUSTMENT_IN") {
  if (!session.user.companyId) {
    fail("Cannot create QA posting movement without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("UserId", sql.UniqueIdentifier, session.user.userId ?? null)
      .input("MovementNumber", sql.NVarChar(40), movementNumber)
      .input("MovementType", sql.NVarChar(40), movementType)
      .input("Quantity", sql.Decimal(18, 6), quantity)
      .input("UnitCost", sql.Decimal(18, 6), unitCost)
      .query(`
        DECLARE @MovementId UNIQUEIDENTIFIER = NEWID();
        DECLARE @LineId UNIQUEIDENTIFIER = NEWID();
        DECLARE @ItemId UNIQUEIDENTIFIER;
        DECLARE @WarehouseId UNIQUEIDENTIFIER;
        DECLARE @UnitOfMeasureId UNIQUEIDENTIFIER;

        SELECT @ItemId = ItemId, @UnitOfMeasureId = UnitOfMeasureId
        FROM inventory.Items
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND Code = 'ART-DEMO';

        SELECT @WarehouseId = WarehouseId
        FROM inventory.Warehouses
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND Code = 'ALM-PRINCIPAL';

        IF @ItemId IS NULL OR @WarehouseId IS NULL
        BEGIN
          THROW 51000, 'Cannot create QA posting movement without ART-DEMO and ALM-PRINCIPAL.', 1;
        END;

        INSERT INTO inventory.InventoryMovements (
          InventoryMovementId, TenantId, CompanyId, MovementNumber, MovementType,
          MovementDate, Status, SourceModule, Reference, Notes, IsActive, CreatedBy
        )
        VALUES (
          @MovementId, @TenantId, @CompanyId, @MovementNumber, @MovementType,
          SYSUTCDATETIME(), 'DRAFT', 'SMOKE_LOCAL', 'Smoke posting QA',
          'Movimiento generado por smoke local para validar posteo idempotente', 1, @UserId
        );

        INSERT INTO inventory.InventoryMovementLines (
          InventoryMovementLineId, InventoryMovementId, TenantId, CompanyId,
          LineNumber, ItemId, WarehouseId, UnitOfMeasureId, Quantity, UnitCost,
          Notes, CreatedBy
        )
        VALUES (
          @LineId, @MovementId, @TenantId, @CompanyId,
          1, @ItemId, @WarehouseId, @UnitOfMeasureId, @Quantity, @UnitCost,
          'Linea smoke local posteable', @UserId
        );

        SELECT @MovementId AS movementId, @MovementNumber AS movementNumber;
      `);

    return result.recordset[0];
  } finally {
    await pool.close();
  }
}

async function createQaTransferMovement(session, movementNumber, quantity) {
  if (!session.user.companyId) {
    fail("Cannot create QA transfer movement without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("UserId", sql.UniqueIdentifier, session.user.userId ?? null)
      .input("MovementNumber", sql.NVarChar(40), movementNumber)
      .input("Quantity", sql.Decimal(18, 6), quantity)
      .query(`
        DECLARE @MovementId UNIQUEIDENTIFIER = NEWID();
        DECLARE @LineId UNIQUEIDENTIFIER = NEWID();
        DECLARE @ItemId UNIQUEIDENTIFIER;
        DECLARE @OriginWarehouseId UNIQUEIDENTIFIER;
        DECLARE @DestinationWarehouseId UNIQUEIDENTIFIER;
        DECLARE @UnitOfMeasureId UNIQUEIDENTIFIER;

        SELECT @ItemId = ItemId, @UnitOfMeasureId = UnitOfMeasureId
        FROM inventory.Items
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND Code = 'ART-DEMO';

        SELECT @OriginWarehouseId = WarehouseId
        FROM inventory.Warehouses
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND Code = 'ALM-PRINCIPAL';

        SELECT @DestinationWarehouseId = WarehouseId
        FROM inventory.Warehouses
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND Code = 'ALM-TRANSITO';

        IF @ItemId IS NULL OR @OriginWarehouseId IS NULL OR @DestinationWarehouseId IS NULL
        BEGIN
          THROW 51000, 'Cannot create QA transfer movement without ART-DEMO, ALM-PRINCIPAL and ALM-TRANSITO.', 1;
        END;

        INSERT INTO inventory.InventoryMovements (
          InventoryMovementId, TenantId, CompanyId, MovementNumber, MovementType,
          MovementDate, Status, SourceModule, Reference, Notes, IsActive, CreatedBy
        )
        VALUES (
          @MovementId, @TenantId, @CompanyId, @MovementNumber, 'TRANSFER',
          SYSUTCDATETIME(), 'DRAFT', 'SMOKE_LOCAL', 'Smoke transfer QA',
          'Movimiento generado por smoke local para validar transferencia idempotente', 1, @UserId
        );

        INSERT INTO inventory.InventoryMovementLines (
          InventoryMovementLineId, InventoryMovementId, TenantId, CompanyId,
          LineNumber, ItemId, WarehouseId, ToWarehouseId, UnitOfMeasureId, Quantity, UnitCost,
          Notes, CreatedBy
        )
        VALUES (
          @LineId, @MovementId, @TenantId, @CompanyId,
          1, @ItemId, @OriginWarehouseId, @DestinationWarehouseId, @UnitOfMeasureId, @Quantity, 0,
          'Linea smoke local transferible', @UserId
        );

        SELECT @MovementId AS movementId, @MovementNumber AS movementNumber;
      `);

    return result.recordset[0];
  } finally {
    await pool.close();
  }
}

async function getDemoInventoryReferences(session) {
  if (!session.user.companyId) {
    fail("Cannot get demo inventory references without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        SELECT
          item.ItemId AS itemId,
          item.UnitOfMeasureId AS unitOfMeasureId,
          warehouse.WarehouseId AS warehouseId
        FROM inventory.Items item
        CROSS JOIN inventory.Warehouses warehouse
        WHERE item.TenantId = @TenantId
          AND item.CompanyId = @CompanyId
          AND item.Code = 'ART-DEMO'
          AND warehouse.TenantId = @TenantId
          AND warehouse.CompanyId = @CompanyId
          AND warehouse.Code = 'ALM-PRINCIPAL';
      `);

    const row = result.recordset[0];

    if (!row?.itemId || !row?.warehouseId) {
      fail("Cannot validate inventory adjustments without ART-DEMO and ALM-PRINCIPAL IDs.");
    }

    return row;
  } finally {
    await pool.close();
  }
}

async function getDemoPurchaseReferences(session) {
  if (!session.user.companyId) {
    fail("Cannot get demo purchase references without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        SELECT
          supplier.SupplierId AS supplierId,
          item.ItemId AS itemId,
          item.UnitOfMeasureId AS unitOfMeasureId,
          warehouse.WarehouseId AS warehouseId
        FROM purchasing.Suppliers supplier
        CROSS JOIN inventory.Items item
        CROSS JOIN inventory.Warehouses warehouse
        WHERE supplier.TenantId = @TenantId
          AND supplier.CompanyId = @CompanyId
          AND supplier.Code = 'SUP-DEMO'
          AND item.TenantId = @TenantId
          AND item.CompanyId = @CompanyId
          AND item.Code = 'ART-DEMO'
          AND warehouse.TenantId = @TenantId
          AND warehouse.CompanyId = @CompanyId
          AND warehouse.Code = 'ALM-PRINCIPAL';
      `);

    const row = result.recordset[0];

    if (!row?.supplierId || !row?.itemId || !row?.warehouseId) {
      fail("Cannot validate purchase orders without SUP-DEMO, ART-DEMO and ALM-PRINCIPAL IDs.");
    }

    return row;
  } finally {
    await pool.close();
  }
}

async function countInventoryMovements(session) {
  if (!session.user.companyId) {
    fail("Cannot count inventory movements without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        SELECT COUNT(1) AS MovementCount
        FROM inventory.InventoryMovements
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `);

    return Number(result.recordset[0]?.MovementCount ?? 0);
  } finally {
    await pool.close();
  }
}

async function countPhysicalCountAdjustments(session, countNumber) {
  if (!session.user.companyId) {
    fail("Cannot count physical count adjustments without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("Reference", sql.NVarChar(120), `Conteo fisico ${countNumber}`)
      .query(`
        SELECT COUNT(1) AS AdjustmentCount
        FROM inventory.InventoryMovements
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SourceModule = 'INVENTORY_ADJUSTMENT'
          AND Reference = @Reference;
      `);

    return Number(result.recordset[0]?.AdjustmentCount ?? 0);
  } finally {
    await pool.close();
  }
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

async function getDemoStockSnapshot(session) {
  if (!session.user.companyId) {
    fail("Cannot validate demo stock without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        SELECT
          stock.QuantityOnHand,
          stock.QuantityReserved,
          stock.QuantityAvailable
        FROM inventory.ItemStocks stock
        INNER JOIN inventory.Items item
          ON item.ItemId = stock.ItemId
        INNER JOIN inventory.Warehouses warehouse
          ON warehouse.WarehouseId = stock.WarehouseId
        WHERE stock.TenantId = @TenantId
          AND stock.CompanyId = @CompanyId
          AND item.Code = 'ART-DEMO'
          AND warehouse.Code = 'ALM-PRINCIPAL';
      `);

    const row = result.recordset[0];

    if (!row) {
      fail("Demo inventory stock ART-DEMO + ALM-PRINCIPAL was not found.");
    }

    return {
      quantityOnHand: Number(row.QuantityOnHand ?? 0),
      quantityReserved: Number(row.QuantityReserved ?? 0),
      quantityAvailable: Number(row.QuantityAvailable ?? 0)
    };
  } finally {
    await pool.close();
  }
}

async function validateDemoMovementDoesNotAffectStock(session) {
  await getDemoStockSnapshot(session);
}

async function validateInventoryPostingFlow(session) {
  const quantityToPost = 2;
  const unitCost = 100;
  const movementNumber = `MOV-POST-${smokeRun}`;
  const initialStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const movement = await createQaPostableMovement(session, movementNumber, quantityToPost, unitCost);

  smokeStep("inventory movement post");
  const posted = await postInventoryMovement(movement.movementId, session);

  if (posted.status !== "POSTED" || !posted.postedAt) {
    fail("Inventory movement post did not return POSTED status with PostedAt.");
  }

  const postedMovement = await findCatalogRecord("inventory-movements", movementNumber, session);

  if (!postedMovement || postedMovement.status !== "POSTED" || !postedMovement.postedAt) {
    fail(`Posted inventory movement ${movementNumber} was not visible as POSTED in runtime metadata.`);
  }

  const updatedStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (updatedStock.quantityOnHand !== initialStock.quantityOnHand + quantityToPost) {
    fail("Inventory posting did not increase ItemStocks.QuantityOnHand by the expected quantity.");
  }

  if (!updatedStock.lastMovementAt) {
    fail("Inventory posting did not update ItemStocks.LastMovementAt.");
  }

  const stockRuntimeRecord = await findCatalogRecord("inventory-stocks", "ART-DEMO", session);

  if (!stockRuntimeRecord || Number(stockRuntimeRecord.quantityOnHand) !== updatedStock.quantityOnHand) {
    fail("/master-data/inventory-stocks did not reflect the posted stock quantity.");
  }

  await assertInventoryLedgerEntries(session, movementNumber, [
    {
      movementType: "ADJUSTMENT_IN",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: quantityToPost,
      quantityOut: 0,
      quantityBalanceImpact: quantityToPost
    }
  ]);

  smokeStep("inventory movement repost rejected");
  await expectInventoryMovementPostFailure(movement.movementId, session);

  const stockAfterRetry = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterRetry.quantityOnHand !== updatedStock.quantityOnHand) {
    fail("Reposting the same inventory movement duplicated stock.");
  }

  await assertInventoryLedgerEntries(session, movementNumber, [
    {
      movementType: "ADJUSTMENT_IN",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: quantityToPost,
      quantityOut: 0,
      quantityBalanceImpact: quantityToPost
    }
  ]);

  const openingQuantity = 1;
  const openingMovementNumber = `MOV-OPEN-${smokeRun}`;
  const stockBeforeOpening = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const openingMovement = await createQaPostableMovement(
    session,
    openingMovementNumber,
    openingQuantity,
    90,
    "OPENING"
  );

  smokeStep("inventory opening movement post");
  const postedOpening = await postInventoryMovement(openingMovement.movementId, session);

  if (postedOpening.status !== "POSTED" || postedOpening.movementType !== "OPENING") {
    fail("Inventory opening movement did not post as OPENING + POSTED.");
  }

  const stockAfterOpening = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterOpening.quantityOnHand !== stockBeforeOpening.quantityOnHand + openingQuantity) {
    fail("Posting an opening movement did not increase stock by the expected quantity.");
  }

  await assertInventoryLedgerEntries(session, openingMovementNumber, [
    {
      movementType: "OPENING",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: openingQuantity,
      quantityOut: 0,
      quantityBalanceImpact: openingQuantity
    }
  ]);
}

async function ensureTransferSourceStock(session, requiredQuantity) {
  const sourceStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const availableToTransfer = sourceStock.quantityOnHand - sourceStock.quantityReserved;

  if (sourceStock.quantityOnHand >= requiredQuantity && availableToTransfer >= requiredQuantity) {
    return;
  }

  const replenishmentQuantity = requiredQuantity - availableToTransfer;
  const movementNumber = `MOV-TRANSFER-STOCK-${smokeRun}`;
  const movement = await createQaPostableMovement(session, movementNumber, replenishmentQuantity, 100);

  smokeStep("inventory transfer source stock replenish");
  await postInventoryMovement(movement.movementId, session);
}

async function validateInventoryTransferFlow(session) {
  const quantityToTransfer = 1;

  await ensureTransferSourceStock(session, quantityToTransfer);

  const movementNumber = `MOV-TRANSFER-${smokeRun}`;
  const initialOriginStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const initialDestinationStock =
    (await getOptionalStockSnapshot(session, "ART-DEMO", "ALM-TRANSITO")) ?? {
      quantityOnHand: 0,
      quantityReserved: 0,
      quantityAvailable: 0,
      averageCost: 0,
      lastCost: 0,
      lastMovementAt: null
    };
  const movement = await createQaTransferMovement(session, movementNumber, quantityToTransfer);

  smokeStep("inventory transfer movement post");
  const posted = await postInventoryMovement(movement.movementId, session);

  if (posted.status !== "POSTED" || posted.movementType !== "TRANSFER" || !posted.postedAt) {
    fail("Inventory transfer post did not return TRANSFER + POSTED status with PostedAt.");
  }

  const postedMovement = await findCatalogRecord("inventory-movements", movementNumber, session);

  if (!postedMovement || postedMovement.status !== "POSTED" || postedMovement.movementType !== "TRANSFER") {
    fail(`Posted inventory transfer ${movementNumber} was not visible as TRANSFER + POSTED in runtime metadata.`);
  }

  const updatedOriginStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const updatedDestinationStock = await getStockSnapshot(session, "ART-DEMO", "ALM-TRANSITO");

  if (updatedOriginStock.quantityOnHand !== initialOriginStock.quantityOnHand - quantityToTransfer) {
    fail("Inventory transfer did not decrease origin QuantityOnHand by the expected quantity.");
  }

  if (updatedDestinationStock.quantityOnHand !== initialDestinationStock.quantityOnHand + quantityToTransfer) {
    fail("Inventory transfer did not increase destination QuantityOnHand by the expected quantity.");
  }

  if (!updatedOriginStock.lastMovementAt || !updatedDestinationStock.lastMovementAt) {
    fail("Inventory transfer did not update LastMovementAt for origin and destination stocks.");
  }

  const originRuntimeRecord = await findInventoryStockRuntimeRecord(
    session,
    "ART-DEMO",
    "ALM-PRINCIPAL"
  );
  const destinationRuntimeRecord = await findInventoryStockRuntimeRecord(
    session,
    "ART-DEMO",
    "ALM-TRANSITO"
  );

  if (!originRuntimeRecord) {
    fail("/master-data/inventory-stocks did not reflect the transfer origin stock.");
  }

  if (!destinationRuntimeRecord) {
    fail("/master-data/inventory-stocks did not reflect the transfer destination stock.");
  }

  await assertInventoryLedgerEntries(session, movementNumber, [
    {
      movementType: "TRANSFER",
      ledgerDirection: "IN",
      warehouseCode: "ALM-TRANSITO",
      quantityIn: quantityToTransfer,
      quantityOut: 0,
      quantityBalanceImpact: quantityToTransfer
    },
    {
      movementType: "TRANSFER",
      ledgerDirection: "OUT",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: 0,
      quantityOut: quantityToTransfer,
      quantityBalanceImpact: -quantityToTransfer
    }
  ]);

  smokeStep("inventory transfer repost rejected");
  await expectInventoryMovementPostFailure(movement.movementId, session);

  const originStockAfterRetry = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const destinationStockAfterRetry = await getStockSnapshot(session, "ART-DEMO", "ALM-TRANSITO");

  if (originStockAfterRetry.quantityOnHand !== updatedOriginStock.quantityOnHand) {
    fail("Reposting the same inventory transfer duplicated origin stock movement.");
  }

  if (destinationStockAfterRetry.quantityOnHand !== updatedDestinationStock.quantityOnHand) {
    fail("Reposting the same inventory transfer duplicated destination stock movement.");
  }

  await assertInventoryLedgerEntries(session, movementNumber, [
    {
      movementType: "TRANSFER",
      ledgerDirection: "IN",
      warehouseCode: "ALM-TRANSITO",
      quantityIn: quantityToTransfer,
      quantityOut: 0,
      quantityBalanceImpact: quantityToTransfer
    },
    {
      movementType: "TRANSFER",
      ledgerDirection: "OUT",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: 0,
      quantityOut: quantityToTransfer,
      quantityBalanceImpact: -quantityToTransfer
    }
  ]);
}

async function validateInventoryAdjustmentApiFlow(session) {
  const references = await getDemoInventoryReferences(session);

  const initialStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  smokeStep("inventory adjustment in create");
  const adjustmentIn = await createInventoryAdjustment(
    {
      movementType: "ADJUSTMENT_IN",
      reference: `Smoke adjustment in ${smokeRun}`,
      notes: "Ajuste de entrada generado por smoke local",
      lines: [
        {
          itemId: references.itemId,
          warehouseId: references.warehouseId,
          unitOfMeasureId: references.unitOfMeasureId,
          quantity: 3,
          unitCost: 50,
          notes: "Entrada smoke local"
        }
      ]
    },
    session
  );

  if (adjustmentIn.status !== "DRAFT" || adjustmentIn.movementType !== "ADJUSTMENT_IN") {
    fail("Inventory adjustment in was not created as ADJUSTMENT_IN + DRAFT.");
  }

  const stockAfterCreateIn = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterCreateIn.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Creating an inventory adjustment in changed stock before posting.");
  }

  smokeStep("inventory adjustment in post");
  const postedIn = await postInventoryMovement(adjustmentIn.id, session);

  if (postedIn.status !== "POSTED" || postedIn.movementType !== "ADJUSTMENT_IN") {
    fail("Inventory adjustment in did not post as ADJUSTMENT_IN + POSTED.");
  }

  const stockAfterPostIn = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterPostIn.quantityOnHand !== initialStock.quantityOnHand + 3) {
    fail("Posting an inventory adjustment in did not increase stock by 3.");
  }

  await assertInventoryLedgerEntries(session, adjustmentIn.movementNumber, [
    {
      movementType: "ADJUSTMENT_IN",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: 3,
      quantityOut: 0,
      quantityBalanceImpact: 3
    }
  ]);

  smokeStep("inventory adjustment in repost rejected");
  await expectInventoryMovementPostFailure(adjustmentIn.id, session);

  const stockAfterRetryIn = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterRetryIn.quantityOnHand !== stockAfterPostIn.quantityOnHand) {
    fail("Reposting the inventory adjustment in duplicated stock.");
  }

  await assertInventoryLedgerEntries(session, adjustmentIn.movementNumber, [
    {
      movementType: "ADJUSTMENT_IN",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: 3,
      quantityOut: 0,
      quantityBalanceImpact: 3
    }
  ]);

  smokeStep("inventory adjustment out create");
  const adjustmentOut = await createInventoryAdjustment(
    {
      movementType: "ADJUSTMENT_OUT",
      reference: `Smoke adjustment out ${smokeRun}`,
      notes: "Ajuste de salida generado por smoke local",
      lines: [
        {
          itemId: references.itemId,
          warehouseId: references.warehouseId,
          unitOfMeasureId: references.unitOfMeasureId,
          quantity: 1,
          unitCost: 0,
          notes: "Salida smoke local"
        }
      ]
    },
    session
  );

  if (adjustmentOut.status !== "DRAFT" || adjustmentOut.movementType !== "ADJUSTMENT_OUT") {
    fail("Inventory adjustment out was not created as ADJUSTMENT_OUT + DRAFT.");
  }

  const stockAfterCreateOut = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterCreateOut.quantityOnHand !== stockAfterPostIn.quantityOnHand) {
    fail("Creating an inventory adjustment out changed stock before posting.");
  }

  smokeStep("inventory adjustment out post");
  const postedOut = await postInventoryMovement(adjustmentOut.id, session);

  if (postedOut.status !== "POSTED" || postedOut.movementType !== "ADJUSTMENT_OUT") {
    fail("Inventory adjustment out did not post as ADJUSTMENT_OUT + POSTED.");
  }

  const stockAfterPostOut = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterPostOut.quantityOnHand !== stockAfterPostIn.quantityOnHand - 1) {
    fail("Posting an inventory adjustment out did not decrease stock by 1.");
  }

  await assertInventoryLedgerEntries(session, adjustmentOut.movementNumber, [
    {
      movementType: "ADJUSTMENT_OUT",
      ledgerDirection: "OUT",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: 0,
      quantityOut: 1,
      quantityBalanceImpact: -1
    }
  ]);

  smokeStep("inventory adjustment out repost rejected");
  await expectInventoryMovementPostFailure(adjustmentOut.id, session);

  const stockAfterRetryOut = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterRetryOut.quantityOnHand !== stockAfterPostOut.quantityOnHand) {
    fail("Reposting the inventory adjustment out duplicated stock.");
  }

  await assertInventoryLedgerEntries(session, adjustmentOut.movementNumber, [
    {
      movementType: "ADJUSTMENT_OUT",
      ledgerDirection: "OUT",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: 0,
      quantityOut: 1,
      quantityBalanceImpact: -1
    }
  ]);
}

async function validatePhysicalCountFlow(session) {
  const references = await getDemoInventoryReferences(session);
  const differenceQuantity = 2;
  const initialStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  smokeStep("inventory physical count create");
  const physicalCount = await createPhysicalCount(
    {
      warehouseId: references.warehouseId,
      reference: `Smoke physical count ${smokeRun}`,
      notes: "Conteo fisico generado por smoke local"
    },
    session
  );

  if (physicalCount.status !== "DRAFT" || Number(physicalCount.lineCount ?? 0) !== 0) {
    fail("Physical count was not created as DRAFT without lines.");
  }

  smokeStep("inventory physical count line");
  const countLine = await addPhysicalCountLine(
    physicalCount.id,
    {
      itemId: references.itemId,
      countedQuantity: initialStock.quantityOnHand + differenceQuantity,
      unitCost: 75,
      notes: "Linea de conteo smoke local"
    },
    session
  );

  if (
    Number(countLine.snapshotQuantity ?? 0) !== initialStock.quantityOnHand ||
    Number(countLine.countedQuantity ?? 0) !== initialStock.quantityOnHand + differenceQuantity ||
    Number(countLine.differenceQuantity ?? 0) !== differenceQuantity
  ) {
    fail("Physical count line did not keep the expected stock snapshot and positive difference.");
  }

  smokeStep("inventory physical count complete");
  const completedCount = await completePhysicalCount(physicalCount.id, session);

  if (
    completedCount.status !== "COMPLETED" ||
    Number(completedCount.lineCount ?? 0) !== 1 ||
    Number(completedCount.totalDifferenceQuantity ?? 0) !== differenceQuantity
  ) {
    fail("Physical count did not complete with the expected difference.");
  }

  const stockAfterComplete = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterComplete.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Completing a physical count changed stock before adjustment posting.");
  }

  smokeStep("inventory physical count adjustment draft");
  const physicalCountAdjustment = await createPhysicalCountAdjustment(physicalCount.id, session);
  const generatedCount = physicalCountAdjustment.physicalCount;
  const generatedAdjustment = physicalCountAdjustment.adjustment;

  if (generatedCount.status !== "ADJUSTMENT_CREATED" || !generatedCount.adjustmentMovementId) {
    fail("Physical count did not link the generated adjustment movement.");
  }

  if (
    generatedAdjustment.status !== "DRAFT" ||
    generatedAdjustment.movementType !== "ADJUSTMENT_IN"
  ) {
    fail("Physical count adjustment was not created as ADJUSTMENT_IN + DRAFT.");
  }

  const stockAfterAdjustmentDraft = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterAdjustmentDraft.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Generating a physical count adjustment changed stock before posting.");
  }

  const adjustmentCountAfterCreate = await countPhysicalCountAdjustments(session, generatedCount.countNumber);

  if (adjustmentCountAfterCreate !== 1) {
    fail("Physical count adjustment generation did not create exactly one adjustment movement.");
  }

  smokeStep("inventory physical count adjustment recreate rejected");
  await expectPhysicalCountAdjustmentFailure(physicalCount.id, session);

  const adjustmentCountAfterRetry = await countPhysicalCountAdjustments(session, generatedCount.countNumber);

  if (adjustmentCountAfterRetry !== 1) {
    fail("Retrying physical count adjustment generation duplicated adjustment movements.");
  }

  smokeStep("inventory physical count adjustment post");
  const postedAdjustment = await postInventoryMovement(generatedAdjustment.id, session);

  if (postedAdjustment.status !== "POSTED" || postedAdjustment.movementType !== "ADJUSTMENT_IN") {
    fail("Physical count generated adjustment did not post as ADJUSTMENT_IN + POSTED.");
  }

  const stockAfterPost = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterPost.quantityOnHand !== initialStock.quantityOnHand + differenceQuantity) {
    fail("Posting the physical count adjustment did not increase stock by the expected difference.");
  }

  await assertInventoryLedgerEntries(session, generatedAdjustment.movementNumber, [
    {
      movementType: "ADJUSTMENT_IN",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: differenceQuantity,
      quantityOut: 0,
      quantityBalanceImpact: differenceQuantity
    }
  ]);

  smokeStep("inventory physical count adjustment repost rejected");
  await expectInventoryMovementPostFailure(generatedAdjustment.id, session);

  const stockAfterRetry = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterRetry.quantityOnHand !== stockAfterPost.quantityOnHand) {
    fail("Reposting the physical count adjustment duplicated stock.");
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

    if (catalog.code === "inventory-movements") {
      const fields = metadata.data.fields.map((field) => field.field);
      const missingFields = [
        "movementNumber",
        "movementType",
        "movementDate",
        "status",
        "sourceModule",
        "sourceDocumentNumber",
        "reference",
        "lineCount",
        "totalQuantity",
        "totalCost",
        "postedAt",
        "voidedAt",
        "isActive"
      ].filter((field) => !fields.includes(field));

      if (missingFields.length) {
        fail(`inventory-movements metadata is missing fields: ${missingFields.join(", ")}.`);
      }

      if (metadata.data.catalog.readOnly !== true) {
        fail("inventory-movements metadata did not report readOnly=true.");
      }

      const unavailableActions = ["create", "update", "activate", "deactivate"]
        .map((actionName) => metadata.data.actions.find((action) => action.action === actionName))
        .filter((action) => action?.available !== false);

      if (unavailableActions.length) {
        fail("inventory-movements write actions must be unavailable.");
      }

      if (seedRecord.status !== "DRAFT") {
        fail("MOV-DEMO-001 must stay in DRAFT status.");
      }

      if (Number(seedRecord.lineCount ?? 0) < 1 || Number(seedRecord.totalQuantity ?? 0) < 1) {
        fail("MOV-DEMO-001 must include a visible demo line quantity.");
      }

      await validateDemoMovementDoesNotAffectStock(session);
    }

    if (catalog.code === "inventory-movement-lines") {
      const fields = metadata.data.fields.map((field) => field.field);
      const missingFields = [
        "movementNumber",
        "movementType",
        "status",
        "lineNumber",
        "itemCode",
        "itemDescription",
        "warehouseCode",
        "quantity",
        "unitCost",
        "totalCost"
      ].filter((field) => !fields.includes(field));

      if (missingFields.length) {
        fail(`inventory-movement-lines metadata is missing fields: ${missingFields.join(", ")}.`);
      }

      if (metadata.data.catalog.readOnly !== true) {
        fail("inventory-movement-lines metadata did not report readOnly=true.");
      }

      const createAction = metadata.data.actions.find((action) => action.action === "create");

      if (createAction?.available !== false) {
        fail("inventory-movement-lines create action must be unavailable.");
      }

      if (seedRecord.itemCode !== "ART-DEMO" || seedRecord.warehouseCode !== "ALM-PRINCIPAL") {
        fail("MOV-DEMO-001 line must reference ART-DEMO + ALM-PRINCIPAL.");
      }
    }
  }
}

async function validateInventoryLedgerMetadata(session) {
  smokeStep("metadata inventory-ledger");
  const metadata = await expectOk("/master-data/inventory-ledger/metadata", {
    headers: authHeaders(session)
  });

  if (metadata.data?.catalog?.readOnly !== true) {
    fail("inventory-ledger metadata must be read-only.");
  }

  const fields = metadata.data.fields.map((field) => field.field);
  const missingFields = [
    "movementNumber",
    "movementType",
    "ledgerDirection",
    "movementDate",
    "postedAt",
    "itemCode",
    "warehouseCode",
    "quantityIn",
    "quantityOut",
    "quantityBalanceImpact"
  ].filter((field) => !fields.includes(field));

  if (missingFields.length) {
    fail(`inventory-ledger metadata is missing fields: ${missingFields.join(", ")}.`);
  }
}

async function validatePurchaseOrderMetadata(session) {
  for (const catalog of ["purchase-orders", "purchase-order-lines"]) {
    smokeStep(`metadata ${catalog}`);
    const metadata = await expectOk(`/master-data/${catalog}/metadata`, {
      headers: authHeaders(session)
    });

    if (metadata.data?.catalog?.readOnly !== true) {
      fail(`${catalog} metadata must be read-only.`);
    }

    const fields = metadata.data.fields.map((field) => field.field);
    const expectedFields =
      catalog === "purchase-orders"
        ? ["purchaseOrderNumber", "supplierCode", "supplierName", "status", "orderDate", "totalAmount"]
        : ["purchaseOrderNumber", "status", "lineNumber", "itemCode", "warehouseCode", "quantity", "lineTotal"];
    const missingFields = expectedFields.filter((field) => !fields.includes(field));

    if (missingFields.length) {
      fail(`${catalog} metadata is missing fields: ${missingFields.join(", ")}.`);
    }
  }
}

async function validatePurchaseReceiptMetadata(session) {
  for (const catalog of ["purchase-receipts", "purchase-receipt-lines"]) {
    smokeStep(`metadata ${catalog}`);
    const metadata = await expectOk(`/master-data/${catalog}/metadata`, {
      headers: authHeaders(session)
    });

    if (metadata.data?.catalog?.readOnly !== true) {
      fail(`${catalog} metadata must be read-only.`);
    }

    const fields = metadata.data.fields.map((field) => field.field);
    const expectedFields =
      catalog === "purchase-receipts"
        ? ["purchaseReceiptNumber", "purchaseOrderNumber", "supplierCode", "status", "receiptDate", "totalQuantityReceived"]
        : ["purchaseReceiptNumber", "purchaseOrderNumber", "status", "lineNumber", "itemCode", "warehouseCode", "quantityReceived"];
    const missingFields = expectedFields.filter((field) => !fields.includes(field));

    if (missingFields.length) {
      fail(`${catalog} metadata is missing fields: ${missingFields.join(", ")}.`);
    }
  }
}

async function validatePurchaseOrderFlow(session) {
  const references = await getDemoPurchaseReferences(session);
  const initialStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const initialMovementCount = await countInventoryMovements(session);
  const expectedDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  smokeStep("purchase order create");
  const purchaseOrder = await createPurchaseOrder(
    {
      supplierId: references.supplierId,
      expectedDate,
      reference: `Smoke purchase order ${smokeRun}`,
      notes: "Orden de compra generada por smoke local",
      lines: [
        {
          itemId: references.itemId,
          warehouseId: references.warehouseId,
          unitOfMeasureId: references.unitOfMeasureId,
          quantity: 4,
          unitCost: 25,
          notes: "Linea de orden de compra smoke local"
        }
      ]
    },
    session
  );

  if (
    purchaseOrder.status !== "DRAFT" ||
    Number(purchaseOrder.lineCount ?? 0) !== 1 ||
    Number(purchaseOrder.totalQuantity ?? 0) !== 4 ||
    Number(purchaseOrder.totalAmount ?? 0) !== 100
  ) {
    fail("Purchase order was not created as DRAFT with the expected totals.");
  }

  const runtimeOrder = await findCatalogRecord("purchase-orders", purchaseOrder.purchaseOrderNumber, session);

  if (!runtimeOrder || runtimeOrder.status !== "DRAFT") {
    fail("Created purchase order was not visible as DRAFT in runtime metadata.");
  }

  const runtimeLine = await findCatalogRecord("purchase-order-lines", purchaseOrder.purchaseOrderNumber, session);

  if (!runtimeLine || Number(runtimeLine.quantity ?? 0) !== 4) {
    fail("Created purchase order line was not visible in runtime metadata.");
  }

  const stockAfterCreate = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const movementCountAfterCreate = await countInventoryMovements(session);

  if (stockAfterCreate.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Creating a purchase order changed inventory stock.");
  }

  if (movementCountAfterCreate !== initialMovementCount) {
    fail("Creating a purchase order created inventory movements.");
  }

  smokeStep("purchase order approve");
  const approvedOrder = await approvePurchaseOrder(purchaseOrder.id, session);

  if (approvedOrder.status !== "APPROVED" || !approvedOrder.approvedAt) {
    fail("Purchase order was not approved correctly.");
  }

  const stockAfterApprove = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const movementCountAfterApprove = await countInventoryMovements(session);

  if (stockAfterApprove.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Approving a purchase order changed inventory stock.");
  }

  if (movementCountAfterApprove !== initialMovementCount) {
    fail("Approving a purchase order created inventory movements.");
  }

  smokeStep("purchase order cancel");
  const cancelledOrder = await cancelPurchaseOrder(
    purchaseOrder.id,
    "Cancelada por smoke local",
    session
  );

  if (cancelledOrder.status !== "CANCELLED" || !cancelledOrder.cancelledAt) {
    fail("Purchase order was not cancelled correctly.");
  }

  const stockAfterCancel = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const movementCountAfterCancel = await countInventoryMovements(session);

  if (stockAfterCancel.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Cancelling a purchase order changed inventory stock.");
  }

  if (movementCountAfterCancel !== initialMovementCount) {
    fail("Cancelling a purchase order created inventory movements.");
  }
}

async function validatePurchaseReceiptFlow(session) {
  const references = await getDemoPurchaseReferences(session);
  const receiptQuantity = 2;
  const unitCost = 30;
  const initialStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const initialMovementCount = await countInventoryMovements(session);
  const expectedDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const purchaseOrder = await createPurchaseOrder(
    {
      supplierId: references.supplierId,
      expectedDate,
      reference: `Smoke receipt purchase order ${smokeRun}`,
      notes: "Orden aprobada para validar recepcion de compra",
      lines: [
        {
          itemId: references.itemId,
          warehouseId: references.warehouseId,
          unitOfMeasureId: references.unitOfMeasureId,
          quantity: receiptQuantity,
          unitCost,
          notes: "Linea para recepcion smoke local"
        }
      ]
    },
    session
  );

  const approvedOrder = await approvePurchaseOrder(purchaseOrder.id, session);
  const orderLine = approvedOrder.lines?.[0];

  if (approvedOrder.status !== "APPROVED" || !orderLine?.id) {
    fail("Purchase receipt smoke could not prepare an approved purchase order with lines.");
  }

  smokeStep("purchase receipt create");
  const receipt = await createPurchaseReceipt(
    {
      purchaseOrderId: approvedOrder.id,
      reference: `Smoke purchase receipt ${smokeRun}`,
      notes: "Recepcion de compra generada por smoke local"
    },
    session
  );

  if (receipt.status !== "DRAFT" || receipt.purchaseOrderId !== approvedOrder.id) {
    fail("Purchase receipt was not created as DRAFT against the approved purchase order.");
  }

  const runtimeDraftReceipt = await findCatalogRecord("purchase-receipts", receipt.purchaseReceiptNumber, session);

  if (!runtimeDraftReceipt || runtimeDraftReceipt.status !== "DRAFT") {
    fail("Created purchase receipt was not visible as DRAFT in runtime metadata.");
  }

  const stockAfterCreate = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const movementCountAfterCreate = await countInventoryMovements(session);

  if (stockAfterCreate.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Creating a purchase receipt changed stock before posting.");
  }

  if (movementCountAfterCreate !== initialMovementCount) {
    fail("Creating a purchase receipt created inventory movements before posting.");
  }

  smokeStep("purchase receipt line");
  const receiptWithLine = await addPurchaseReceiptLine(
    receipt.id,
    {
      purchaseOrderLineId: orderLine.id,
      quantityReceived: receiptQuantity,
      unitCost,
      notes: "Linea recibida por smoke local"
    },
    session
  );

  if (
    Number(receiptWithLine.lineCount ?? 0) !== 1 ||
    Number(receiptWithLine.totalQuantityReceived ?? 0) !== receiptQuantity
  ) {
    fail("Purchase receipt line was not added with the expected quantity.");
  }

  const runtimeLine = await findCatalogRecord("purchase-receipt-lines", receipt.purchaseReceiptNumber, session);

  if (!runtimeLine || Number(runtimeLine.quantityReceived ?? 0) !== receiptQuantity) {
    fail("Created purchase receipt line was not visible in runtime metadata.");
  }

  const stockAfterLine = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterLine.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Adding a purchase receipt line changed stock before posting.");
  }

  smokeStep("purchase receipt complete/post");
  const postedReceipt = await completePurchaseReceipt(receipt.id, session);

  if (
    postedReceipt.status !== "POSTED" ||
    !postedReceipt.postedAt ||
    !postedReceipt.inventoryMovementId ||
    !postedReceipt.movementNumber
  ) {
    fail("Purchase receipt did not post with an inventory movement link.");
  }

  const postedMovement = await findCatalogRecord("inventory-movements", postedReceipt.movementNumber, session);

  if (
    !postedMovement ||
    postedMovement.status !== "POSTED" ||
    postedMovement.movementType !== "PURCHASE_RECEIPT_PLACEHOLDER"
  ) {
    fail("Purchase receipt movement was not visible as posted PURCHASE_RECEIPT_PLACEHOLDER.");
  }

  const stockAfterPost = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterPost.quantityOnHand !== initialStock.quantityOnHand + receiptQuantity) {
    fail("Posting a purchase receipt did not increase ItemStocks by the received quantity.");
  }

  const movementCountAfterPost = await countInventoryMovements(session);

  if (movementCountAfterPost !== initialMovementCount + 1) {
    fail("Posting a purchase receipt did not create exactly one inventory movement.");
  }

  await assertInventoryLedgerEntries(session, postedReceipt.movementNumber, [
    {
      movementType: "PURCHASE_RECEIPT_PLACEHOLDER",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: receiptQuantity,
      quantityOut: 0,
      quantityBalanceImpact: receiptQuantity
    }
  ]);

  smokeStep("purchase receipt repost rejected");
  await expectPurchaseReceiptCompleteFailure(receipt.id, session);

  const stockAfterRetry = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterRetry.quantityOnHand !== stockAfterPost.quantityOnHand) {
    fail("Reposting the same purchase receipt duplicated stock.");
  }

  await assertInventoryLedgerEntries(session, postedReceipt.movementNumber, [
    {
      movementType: "PURCHASE_RECEIPT_PLACEHOLDER",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: receiptQuantity,
      quantityOut: 0,
      quantityBalanceImpact: receiptQuantity
    }
  ]);

  return postedReceipt;
}

async function validateSupplierInvoiceFlow(session, postedReceipt) {
  const invoiceNumber = `FAC-QA-${smokeRun}`;
  const receiptLine = postedReceipt.lines[0];
  if (!receiptLine) {
    fail("Purchase receipt has no lines to validate supplier invoice.");
  }

  const initialStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const initialMovementCount = await countInventoryMovements(session);

  smokeStep("supplier invoice create");
  const invoice = await createSupplierInvoice(
    {
      purchaseReceiptId: postedReceipt.id,
      supplierInvoiceNumber: invoiceNumber,
      invoiceDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      reference: `REF-INV-${smokeRun}`,
      notes: "Factura de proveedor creada por smoke local"
    },
    session
  );

  if (invoice.status !== "DRAFT" || invoice.purchaseReceiptId !== postedReceipt.id) {
    fail("Supplier invoice was not created as DRAFT against the posted purchase receipt.");
  }

  const runtimeDraftInvoice = await findCatalogRecord("supplier-invoices", invoice.supplierInvoiceNumber, session);
  if (!runtimeDraftInvoice || runtimeDraftInvoice.status !== "DRAFT") {
    fail("Created supplier invoice was not visible as DRAFT in runtime metadata.");
  }

  smokeStep("supplier invoice line");
  const invoiceWithLine = await addSupplierInvoiceLine(
    invoice.id,
    {
      itemId: receiptLine.itemId,
      unitOfMeasureId: receiptLine.unitOfMeasureId,
      quantity: 1,
      unitCost: 30,
      taxAmount: 5.40,
      notes: "Linea de factura smoke local"
    },
    session
  );

  if (
    Number(invoiceWithLine.lineCount ?? 0) !== 1 ||
    Number(invoiceWithLine.totalAmount ?? 0) !== 35.40
  ) {
    fail("Supplier invoice line was not added with the expected totals.");
  }

  const runtimeLine = await findCatalogRecord("supplier-invoice-lines", invoice.supplierInvoiceNumber, session);
  if (!runtimeLine || Number(runtimeLine.quantity ?? 0) !== 1) {
    fail("Created supplier invoice line was not visible in runtime metadata.");
  }

  let quantityValidationFailed = false;
  try {
    await addSupplierInvoiceLine(
      invoice.id,
      {
        itemId: receiptLine.itemId,
        unitOfMeasureId: receiptLine.unitOfMeasureId,
        quantity: 2,
        unitCost: 30,
        taxAmount: 5.40,
        notes: "Exceeding quantity line"
      },
      session
    );
  } catch (err) {
    quantityValidationFailed = true;
  }

  if (!quantityValidationFailed) {
    fail("Adding a supplier invoice line exceeding the purchase receipt received quantity should have thrown an error.");
  }

  smokeStep("supplier invoice complete/post");
  const postedInvoice = await completeSupplierInvoice(invoice.id, session);

  if (postedInvoice.status !== "POSTED" || !postedInvoice.postedAt) {
    fail("Supplier invoice did not post successfully.");
  }

  const stockAfterPost = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  if (stockAfterPost.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Posting a supplier invoice changed physical inventory stocks!");
  }

  const movementCountAfterPost = await countInventoryMovements(session);
  if (movementCountAfterPost !== initialMovementCount) {
    fail("Posting a supplier invoice created inventory movements!");
  }

  smokeStep("accounts payable document generated");
  const cxpDoc = await findCatalogRecord("accounts-payable-documents", `CXP-${invoiceNumber}`, session);

  if (!cxpDoc) {
    fail(`Accounts payable document CXP-${invoiceNumber} was not found.`);
  }

  if (
    cxpDoc.status !== "PENDING" ||
    Number(cxpDoc.totalAmount ?? 0) !== 35.40 ||
    Number(cxpDoc.paidAmount ?? 0) !== 0 ||
    Number(cxpDoc.remainingAmount ?? 0) !== 35.40
  ) {
    fail("Accounts payable document was not generated with the correct pending amounts and status.");
  }

  smokeStep("supplier invoice repost rejected");
  await expectSupplierInvoiceCompleteFailure(invoice.id, session);
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

  await validateInventoryPostingFlow(session);
  await validateInventoryTransferFlow(session);
  await validateInventoryAdjustmentApiFlow(session);
  await validatePhysicalCountFlow(session);
}

async function main() {
  console.log(`smoke: API ${apiUrl}`);
  await validateBackendBasics();
  const session = await loginDemo();
  await validateCatalogs(session);
  await validateInventoryLedgerMetadata(session);
  await validatePurchaseOrderMetadata(session);
  await validatePurchaseReceiptMetadata(session);
  await validatePurchaseOrderFlow(session);
  const postedReceipt = await validatePurchaseReceiptFlow(session);
  await validateSupplierInvoiceFlow(session, postedReceipt);
  await validateCrud(session);
  console.log("smoke: local runtime validation OK");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
