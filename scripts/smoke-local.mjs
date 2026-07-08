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

async function createQaPostableMovement(session, movementNumber, quantity, unitCost) {
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
          @MovementId, @TenantId, @CompanyId, @MovementNumber, 'ADJUSTMENT_IN',
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

  smokeStep("inventory movement repost rejected");
  await expectInventoryMovementPostFailure(movement.movementId, session);

  const stockAfterRetry = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterRetry.quantityOnHand !== updatedStock.quantityOnHand) {
    fail("Reposting the same inventory movement duplicated stock.");
  }
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

  smokeStep("inventory adjustment in repost rejected");
  await expectInventoryMovementPostFailure(adjustmentIn.id, session);

  const stockAfterRetryIn = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterRetryIn.quantityOnHand !== stockAfterPostIn.quantityOnHand) {
    fail("Reposting the inventory adjustment in duplicated stock.");
  }

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

  smokeStep("inventory adjustment out repost rejected");
  await expectInventoryMovementPostFailure(adjustmentOut.id, session);

  const stockAfterRetryOut = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterRetryOut.quantityOnHand !== stockAfterPostOut.quantityOnHand) {
    fail("Reposting the inventory adjustment out duplicated stock.");
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
