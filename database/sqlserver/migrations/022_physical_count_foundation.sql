IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'inventory')
BEGIN
    EXEC('CREATE SCHEMA inventory');
END;
GO

IF OBJECT_ID('inventory.PhysicalCounts', 'U') IS NULL
BEGIN
    CREATE TABLE inventory.PhysicalCounts (
        PhysicalCountId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_inventory_PhysicalCounts_PhysicalCountId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        CountNumber NVARCHAR(40) NOT NULL,
        WarehouseId UNIQUEIDENTIFIER NOT NULL,
        CountDate DATETIME2(7) NOT NULL
            CONSTRAINT DF_inventory_PhysicalCounts_CountDate DEFAULT SYSUTCDATETIME(),
        Status NVARCHAR(30) NOT NULL
            CONSTRAINT DF_inventory_PhysicalCounts_Status DEFAULT 'DRAFT',
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(1000) NULL,
        CompletedAt DATETIME2(7) NULL,
        CompletedBy UNIQUEIDENTIFIER NULL,
        AdjustmentMovementId UNIQUEIDENTIFIER NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_inventory_PhysicalCounts_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_inventory_PhysicalCounts_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_inventory_PhysicalCounts PRIMARY KEY (PhysicalCountId),
        CONSTRAINT FK_inventory_PhysicalCounts_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_inventory_PhysicalCounts_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_inventory_PhysicalCounts_Warehouses FOREIGN KEY (WarehouseId)
            REFERENCES inventory.Warehouses (WarehouseId),
        CONSTRAINT FK_inventory_PhysicalCounts_AdjustmentMovements FOREIGN KEY (AdjustmentMovementId)
            REFERENCES inventory.InventoryMovements (InventoryMovementId),
        CONSTRAINT CK_inventory_PhysicalCounts_Status CHECK (
            Status IN ('DRAFT', 'COMPLETED', 'ADJUSTMENT_CREATED')
        )
    );
END;
GO

IF OBJECT_ID('inventory.PhysicalCountLines', 'U') IS NULL
BEGIN
    CREATE TABLE inventory.PhysicalCountLines (
        PhysicalCountLineId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_inventory_PhysicalCountLines_PhysicalCountLineId DEFAULT NEWSEQUENTIALID(),
        PhysicalCountId UNIQUEIDENTIFIER NOT NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        LineNumber INT NOT NULL,
        ItemId UNIQUEIDENTIFIER NOT NULL,
        WarehouseId UNIQUEIDENTIFIER NOT NULL,
        UnitOfMeasureId UNIQUEIDENTIFIER NULL,
        SnapshotQuantity DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_inventory_PhysicalCountLines_SnapshotQuantity DEFAULT (0),
        CountedQuantity DECIMAL(18,6) NOT NULL,
        DifferenceQuantity AS (CountedQuantity - SnapshotQuantity) PERSISTED,
        UnitCost DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_inventory_PhysicalCountLines_UnitCost DEFAULT (0),
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_inventory_PhysicalCountLines_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_inventory_PhysicalCountLines PRIMARY KEY (PhysicalCountLineId),
        CONSTRAINT FK_inventory_PhysicalCountLines_PhysicalCounts FOREIGN KEY (PhysicalCountId)
            REFERENCES inventory.PhysicalCounts (PhysicalCountId),
        CONSTRAINT FK_inventory_PhysicalCountLines_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_inventory_PhysicalCountLines_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_inventory_PhysicalCountLines_Items FOREIGN KEY (ItemId)
            REFERENCES inventory.Items (ItemId),
        CONSTRAINT FK_inventory_PhysicalCountLines_Warehouses FOREIGN KEY (WarehouseId)
            REFERENCES inventory.Warehouses (WarehouseId),
        CONSTRAINT FK_inventory_PhysicalCountLines_UnitsOfMeasure FOREIGN KEY (UnitOfMeasureId)
            REFERENCES core.UnitsOfMeasure (UnitOfMeasureId),
        CONSTRAINT CK_inventory_PhysicalCountLines_SnapshotQuantity CHECK (SnapshotQuantity >= 0),
        CONSTRAINT CK_inventory_PhysicalCountLines_CountedQuantity CHECK (CountedQuantity >= 0),
        CONSTRAINT CK_inventory_PhysicalCountLines_UnitCost CHECK (UnitCost >= 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.PhysicalCounts')
      AND name = 'UX_inventory_PhysicalCounts_Tenant_Company_Number'
)
BEGIN
    CREATE UNIQUE INDEX UX_inventory_PhysicalCounts_Tenant_Company_Number
        ON inventory.PhysicalCounts (TenantId, CompanyId, CountNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.PhysicalCounts')
      AND name = 'IX_inventory_PhysicalCounts_Tenant_Company_Status'
)
BEGIN
    CREATE INDEX IX_inventory_PhysicalCounts_Tenant_Company_Status
        ON inventory.PhysicalCounts (TenantId, CompanyId, Status);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.PhysicalCountLines')
      AND name = 'UX_inventory_PhysicalCountLines_Count_Line'
)
BEGIN
    CREATE UNIQUE INDEX UX_inventory_PhysicalCountLines_Count_Line
        ON inventory.PhysicalCountLines (PhysicalCountId, LineNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.PhysicalCountLines')
      AND name = 'UX_inventory_PhysicalCountLines_Count_Item'
)
BEGIN
    CREATE UNIQUE INDEX UX_inventory_PhysicalCountLines_Count_Item
        ON inventory.PhysicalCountLines (PhysicalCountId, ItemId);
END;
GO

CREATE OR ALTER VIEW inventory.V_PhysicalCountSummary
AS
SELECT
    countHeader.PhysicalCountId,
    countHeader.TenantId,
    countHeader.CompanyId,
    countHeader.CountNumber,
    countHeader.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    countHeader.CountDate,
    countHeader.Status,
    countHeader.Reference,
    countHeader.Notes,
    countHeader.CompletedAt,
    countHeader.AdjustmentMovementId,
    adjustment.MovementNumber AS AdjustmentMovementNumber,
    countHeader.IsActive,
    countHeader.CreatedAt,
    countHeader.UpdatedAt,
    countHeader.CreatedBy,
    countHeader.UpdatedBy,
    COUNT(line.PhysicalCountLineId) AS LineCount,
    COALESCE(SUM(line.SnapshotQuantity), 0) AS TotalSnapshotQuantity,
    COALESCE(SUM(line.CountedQuantity), 0) AS TotalCountedQuantity,
    COALESCE(SUM(line.DifferenceQuantity), 0) AS TotalDifferenceQuantity
FROM inventory.PhysicalCounts countHeader
INNER JOIN inventory.Warehouses warehouse
    ON warehouse.WarehouseId = countHeader.WarehouseId
LEFT JOIN inventory.InventoryMovements adjustment
    ON adjustment.InventoryMovementId = countHeader.AdjustmentMovementId
LEFT JOIN inventory.PhysicalCountLines line
    ON line.PhysicalCountId = countHeader.PhysicalCountId
GROUP BY
    countHeader.PhysicalCountId,
    countHeader.TenantId,
    countHeader.CompanyId,
    countHeader.CountNumber,
    countHeader.WarehouseId,
    warehouse.Code,
    warehouse.Name,
    countHeader.CountDate,
    countHeader.Status,
    countHeader.Reference,
    countHeader.Notes,
    countHeader.CompletedAt,
    countHeader.AdjustmentMovementId,
    adjustment.MovementNumber,
    countHeader.IsActive,
    countHeader.CreatedAt,
    countHeader.UpdatedAt,
    countHeader.CreatedBy,
    countHeader.UpdatedBy;
GO

CREATE OR ALTER VIEW inventory.V_PhysicalCountLineSummary
AS
SELECT
    line.PhysicalCountLineId,
    line.PhysicalCountId,
    line.TenantId,
    line.CompanyId,
    countHeader.CountNumber,
    countHeader.Status,
    line.LineNumber,
    line.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    line.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    line.UnitOfMeasureId,
    unit.Code AS UnitOfMeasureCode,
    line.SnapshotQuantity,
    line.CountedQuantity,
    line.DifferenceQuantity,
    line.UnitCost,
    line.Notes,
    line.CreatedAt,
    line.UpdatedAt,
    line.CreatedBy,
    line.UpdatedBy
FROM inventory.PhysicalCountLines line
INNER JOIN inventory.PhysicalCounts countHeader
    ON countHeader.PhysicalCountId = line.PhysicalCountId
INNER JOIN inventory.Items item
    ON item.ItemId = line.ItemId
INNER JOIN inventory.Warehouses warehouse
    ON warehouse.WarehouseId = line.WarehouseId
LEFT JOIN core.UnitsOfMeasure unit
    ON unit.UnitOfMeasureId = line.UnitOfMeasureId;
GO
