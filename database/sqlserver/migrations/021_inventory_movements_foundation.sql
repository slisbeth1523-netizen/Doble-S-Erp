IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'inventory')
BEGIN
    EXEC('CREATE SCHEMA inventory');
END;
GO

IF OBJECT_ID('inventory.InventoryMovements', 'U') IS NULL
BEGIN
    CREATE TABLE inventory.InventoryMovements (
        InventoryMovementId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_inventory_InventoryMovements_InventoryMovementId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        MovementNumber NVARCHAR(40) NOT NULL,
        MovementType NVARCHAR(40) NOT NULL,
        MovementDate DATETIME2(7) NOT NULL
            CONSTRAINT DF_inventory_InventoryMovements_MovementDate DEFAULT SYSUTCDATETIME(),
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_inventory_InventoryMovements_Status DEFAULT 'DRAFT',
        SourceModule NVARCHAR(40) NULL,
        SourceDocumentId UNIQUEIDENTIFIER NULL,
        SourceDocumentNumber NVARCHAR(80) NULL,
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(1000) NULL,
        PostedAt DATETIME2(7) NULL,
        PostedBy UNIQUEIDENTIFIER NULL,
        VoidedAt DATETIME2(7) NULL,
        VoidedBy UNIQUEIDENTIFIER NULL,
        VoidReason NVARCHAR(500) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_inventory_InventoryMovements_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_inventory_InventoryMovements_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_inventory_InventoryMovements PRIMARY KEY (InventoryMovementId),
        CONSTRAINT FK_inventory_InventoryMovements_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_inventory_InventoryMovements_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT CK_inventory_InventoryMovements_MovementType CHECK (
            MovementType IN (
                'OPENING',
                'ADJUSTMENT_IN',
                'ADJUSTMENT_OUT',
                'TRANSFER',
                'PURCHASE_RECEIPT_PLACEHOLDER',
                'SALES_ISSUE_PLACEHOLDER',
                'RETURN_IN_PLACEHOLDER',
                'RETURN_OUT_PLACEHOLDER'
            )
        ),
        CONSTRAINT CK_inventory_InventoryMovements_Status CHECK (
            Status IN ('DRAFT', 'POSTED', 'VOIDED')
        )
    );
END;
GO

IF OBJECT_ID('inventory.InventoryMovementLines', 'U') IS NULL
BEGIN
    CREATE TABLE inventory.InventoryMovementLines (
        InventoryMovementLineId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_inventory_InventoryMovementLines_InventoryMovementLineId DEFAULT NEWSEQUENTIALID(),
        InventoryMovementId UNIQUEIDENTIFIER NOT NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        LineNumber INT NOT NULL,
        ItemId UNIQUEIDENTIFIER NOT NULL,
        WarehouseId UNIQUEIDENTIFIER NOT NULL,
        ToWarehouseId UNIQUEIDENTIFIER NULL,
        UnitOfMeasureId UNIQUEIDENTIFIER NULL,
        Quantity DECIMAL(18,6) NOT NULL,
        UnitCost DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_inventory_InventoryMovementLines_UnitCost DEFAULT (0),
        TotalCost AS (Quantity * UnitCost) PERSISTED,
        LotNumber NVARCHAR(100) NULL,
        SerialNumber NVARCHAR(100) NULL,
        ExpirationDate DATE NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_inventory_InventoryMovementLines_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_inventory_InventoryMovementLines PRIMARY KEY (InventoryMovementLineId),
        CONSTRAINT FK_inventory_InventoryMovementLines_InventoryMovements FOREIGN KEY (InventoryMovementId)
            REFERENCES inventory.InventoryMovements (InventoryMovementId),
        CONSTRAINT FK_inventory_InventoryMovementLines_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_inventory_InventoryMovementLines_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_inventory_InventoryMovementLines_Items FOREIGN KEY (ItemId)
            REFERENCES inventory.Items (ItemId),
        CONSTRAINT FK_inventory_InventoryMovementLines_Warehouses FOREIGN KEY (WarehouseId)
            REFERENCES inventory.Warehouses (WarehouseId),
        CONSTRAINT FK_inventory_InventoryMovementLines_ToWarehouses FOREIGN KEY (ToWarehouseId)
            REFERENCES inventory.Warehouses (WarehouseId),
        CONSTRAINT FK_inventory_InventoryMovementLines_UnitsOfMeasure FOREIGN KEY (UnitOfMeasureId)
            REFERENCES core.UnitsOfMeasure (UnitOfMeasureId),
        CONSTRAINT CK_inventory_InventoryMovementLines_Quantity CHECK (Quantity > 0),
        CONSTRAINT CK_inventory_InventoryMovementLines_UnitCost CHECK (UnitCost >= 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.InventoryMovements')
      AND name = 'UX_inventory_InventoryMovements_Tenant_Company_Number'
)
BEGIN
    CREATE UNIQUE INDEX UX_inventory_InventoryMovements_Tenant_Company_Number
        ON inventory.InventoryMovements (TenantId, CompanyId, MovementNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.InventoryMovements')
      AND name = 'IX_inventory_InventoryMovements_Tenant_Company_Date'
)
BEGIN
    CREATE INDEX IX_inventory_InventoryMovements_Tenant_Company_Date
        ON inventory.InventoryMovements (TenantId, CompanyId, MovementDate);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.InventoryMovements')
      AND name = 'IX_inventory_InventoryMovements_Tenant_Company_Status'
)
BEGIN
    CREATE INDEX IX_inventory_InventoryMovements_Tenant_Company_Status
        ON inventory.InventoryMovements (TenantId, CompanyId, Status);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.InventoryMovements')
      AND name = 'IX_inventory_InventoryMovements_Tenant_Company_Type'
)
BEGIN
    CREATE INDEX IX_inventory_InventoryMovements_Tenant_Company_Type
        ON inventory.InventoryMovements (TenantId, CompanyId, MovementType);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.InventoryMovementLines')
      AND name = 'UX_inventory_InventoryMovementLines_Movement_Line'
)
BEGIN
    CREATE UNIQUE INDEX UX_inventory_InventoryMovementLines_Movement_Line
        ON inventory.InventoryMovementLines (InventoryMovementId, LineNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.InventoryMovementLines')
      AND name = 'IX_inventory_InventoryMovementLines_Tenant_Company_Item'
)
BEGIN
    CREATE INDEX IX_inventory_InventoryMovementLines_Tenant_Company_Item
        ON inventory.InventoryMovementLines (TenantId, CompanyId, ItemId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.InventoryMovementLines')
      AND name = 'IX_inventory_InventoryMovementLines_Tenant_Company_Warehouse'
)
BEGIN
    CREATE INDEX IX_inventory_InventoryMovementLines_Tenant_Company_Warehouse
        ON inventory.InventoryMovementLines (TenantId, CompanyId, WarehouseId);
END;
GO

CREATE OR ALTER VIEW inventory.V_InventoryMovementSummary
AS
SELECT
    movement.InventoryMovementId,
    movement.TenantId,
    movement.CompanyId,
    movement.MovementNumber,
    movement.MovementType,
    movement.MovementDate,
    movement.Status,
    movement.SourceModule,
    movement.SourceDocumentNumber,
    movement.Reference,
    movement.Notes,
    movement.PostedAt,
    movement.VoidedAt,
    movement.IsActive,
    movement.CreatedAt,
    movement.UpdatedAt,
    movement.CreatedBy,
    movement.UpdatedBy,
    COUNT(line.InventoryMovementLineId) AS LineCount,
    COALESCE(SUM(line.Quantity), 0) AS TotalQuantity,
    COALESCE(SUM(line.TotalCost), 0) AS TotalCost
FROM inventory.InventoryMovements movement
LEFT JOIN inventory.InventoryMovementLines line
    ON line.InventoryMovementId = movement.InventoryMovementId
GROUP BY
    movement.InventoryMovementId,
    movement.TenantId,
    movement.CompanyId,
    movement.MovementNumber,
    movement.MovementType,
    movement.MovementDate,
    movement.Status,
    movement.SourceModule,
    movement.SourceDocumentNumber,
    movement.Reference,
    movement.Notes,
    movement.PostedAt,
    movement.VoidedAt,
    movement.IsActive,
    movement.CreatedAt,
    movement.UpdatedAt,
    movement.CreatedBy,
    movement.UpdatedBy;
GO

CREATE OR ALTER VIEW inventory.V_InventoryMovementLineSummary
AS
SELECT
    line.InventoryMovementLineId,
    line.InventoryMovementId,
    line.TenantId,
    line.CompanyId,
    movement.MovementNumber,
    movement.MovementType,
    movement.MovementDate,
    movement.Status,
    movement.IsActive,
    line.LineNumber,
    line.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    line.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    line.ToWarehouseId,
    toWarehouse.Code AS ToWarehouseCode,
    toWarehouse.Name AS ToWarehouseName,
    line.Quantity,
    line.UnitCost,
    line.TotalCost,
    line.LotNumber,
    line.SerialNumber,
    line.ExpirationDate,
    line.CreatedAt,
    line.UpdatedAt,
    line.CreatedBy,
    line.UpdatedBy
FROM inventory.InventoryMovementLines line
INNER JOIN inventory.InventoryMovements movement
    ON movement.InventoryMovementId = line.InventoryMovementId
INNER JOIN inventory.Items item
    ON item.ItemId = line.ItemId
INNER JOIN inventory.Warehouses warehouse
    ON warehouse.WarehouseId = line.WarehouseId
LEFT JOIN inventory.Warehouses toWarehouse
    ON toWarehouse.WarehouseId = line.ToWarehouseId;
GO
