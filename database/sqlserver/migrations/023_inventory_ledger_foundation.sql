IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'inventory')
BEGIN
    EXEC('CREATE SCHEMA inventory');
END;
GO

IF OBJECT_ID('inventory.InventoryLedgerEntries', 'U') IS NULL
BEGIN
    CREATE TABLE inventory.InventoryLedgerEntries (
        InventoryLedgerEntryId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_inventory_InventoryLedgerEntries_InventoryLedgerEntryId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        InventoryMovementId UNIQUEIDENTIFIER NOT NULL,
        InventoryMovementLineId UNIQUEIDENTIFIER NOT NULL,
        MovementNumber NVARCHAR(40) NOT NULL,
        MovementType NVARCHAR(40) NOT NULL,
        MovementDate DATETIME2(7) NOT NULL,
        PostedAt DATETIME2(7) NOT NULL,
        ItemId UNIQUEIDENTIFIER NOT NULL,
        WarehouseId UNIQUEIDENTIFIER NOT NULL,
        UnitOfMeasureId UNIQUEIDENTIFIER NULL,
        LedgerDirection NVARCHAR(10) NOT NULL,
        QuantityIn DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_inventory_InventoryLedgerEntries_QuantityIn DEFAULT (0),
        QuantityOut DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_inventory_InventoryLedgerEntries_QuantityOut DEFAULT (0),
        QuantityBalanceImpact AS (QuantityIn - QuantityOut) PERSISTED,
        UnitCost DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_inventory_InventoryLedgerEntries_UnitCost DEFAULT (0),
        TotalCost DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_inventory_InventoryLedgerEntries_TotalCost DEFAULT (0),
        SourceModule NVARCHAR(40) NULL,
        SourceDocumentNumber NVARCHAR(80) NULL,
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_inventory_InventoryLedgerEntries_CreatedAt DEFAULT SYSUTCDATETIME(),
        CreatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_inventory_InventoryLedgerEntries PRIMARY KEY (InventoryLedgerEntryId),
        CONSTRAINT FK_inventory_InventoryLedgerEntries_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_inventory_InventoryLedgerEntries_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_inventory_InventoryLedgerEntries_InventoryMovements FOREIGN KEY (InventoryMovementId)
            REFERENCES inventory.InventoryMovements (InventoryMovementId),
        CONSTRAINT FK_inventory_InventoryLedgerEntries_InventoryMovementLines FOREIGN KEY (InventoryMovementLineId)
            REFERENCES inventory.InventoryMovementLines (InventoryMovementLineId),
        CONSTRAINT FK_inventory_InventoryLedgerEntries_Items FOREIGN KEY (ItemId)
            REFERENCES inventory.Items (ItemId),
        CONSTRAINT FK_inventory_InventoryLedgerEntries_Warehouses FOREIGN KEY (WarehouseId)
            REFERENCES inventory.Warehouses (WarehouseId),
        CONSTRAINT FK_inventory_InventoryLedgerEntries_UnitsOfMeasure FOREIGN KEY (UnitOfMeasureId)
            REFERENCES core.UnitsOfMeasure (UnitOfMeasureId),
        CONSTRAINT CK_inventory_InventoryLedgerEntries_MovementType CHECK (
            MovementType IN ('OPENING', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER')
        ),
        CONSTRAINT CK_inventory_InventoryLedgerEntries_LedgerDirection CHECK (
            LedgerDirection IN ('IN', 'OUT')
        ),
        CONSTRAINT CK_inventory_InventoryLedgerEntries_Quantities CHECK (
            (QuantityIn > 0 AND QuantityOut = 0) OR (QuantityOut > 0 AND QuantityIn = 0)
        ),
        CONSTRAINT CK_inventory_InventoryLedgerEntries_Costs CHECK (
            UnitCost >= 0 AND TotalCost >= 0
        )
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.InventoryLedgerEntries')
      AND name = 'UX_inventory_InventoryLedgerEntries_Line_Warehouse_Direction'
)
BEGIN
    CREATE UNIQUE INDEX UX_inventory_InventoryLedgerEntries_Line_Warehouse_Direction
        ON inventory.InventoryLedgerEntries (InventoryMovementLineId, WarehouseId, LedgerDirection);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.InventoryLedgerEntries')
      AND name = 'IX_inventory_InventoryLedgerEntries_Tenant_Company_Item_Warehouse_Date'
)
BEGIN
    CREATE INDEX IX_inventory_InventoryLedgerEntries_Tenant_Company_Item_Warehouse_Date
        ON inventory.InventoryLedgerEntries (TenantId, CompanyId, ItemId, WarehouseId, MovementDate);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.InventoryLedgerEntries')
      AND name = 'IX_inventory_InventoryLedgerEntries_Movement'
)
BEGIN
    CREATE INDEX IX_inventory_InventoryLedgerEntries_Movement
        ON inventory.InventoryLedgerEntries (InventoryMovementId, MovementNumber);
END;
GO

CREATE OR ALTER VIEW inventory.V_InventoryLedger
AS
SELECT
    ledger.InventoryLedgerEntryId,
    ledger.TenantId,
    ledger.CompanyId,
    ledger.InventoryMovementId,
    ledger.InventoryMovementLineId,
    ledger.MovementNumber,
    ledger.MovementType,
    ledger.MovementDate,
    ledger.PostedAt,
    ledger.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    ledger.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    ledger.UnitOfMeasureId,
    unit.Code AS UnitOfMeasureCode,
    unit.Name AS UnitOfMeasureName,
    ledger.LedgerDirection,
    ledger.QuantityIn,
    ledger.QuantityOut,
    ledger.QuantityBalanceImpact,
    ledger.UnitCost,
    ledger.TotalCost,
    ledger.SourceModule,
    ledger.SourceDocumentNumber,
    ledger.Reference,
    ledger.Notes,
    CAST(1 AS BIT) AS IsActive,
    ledger.CreatedAt,
    CAST(NULL AS DATETIME2(7)) AS UpdatedAt,
    ledger.CreatedBy,
    CAST(NULL AS UNIQUEIDENTIFIER) AS UpdatedBy
FROM inventory.InventoryLedgerEntries ledger
INNER JOIN inventory.Items item
    ON item.ItemId = ledger.ItemId
INNER JOIN inventory.Warehouses warehouse
    ON warehouse.WarehouseId = ledger.WarehouseId
LEFT JOIN core.UnitsOfMeasure unit
    ON unit.UnitOfMeasureId = ledger.UnitOfMeasureId;
GO
