IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'inventory')
BEGIN
    EXEC('CREATE SCHEMA inventory');
END;
GO

IF OBJECT_ID('inventory.ItemStocks', 'U') IS NULL
BEGIN
    CREATE TABLE inventory.ItemStocks (
        ItemStockId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_inventory_ItemStocks_ItemStockId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        ItemId UNIQUEIDENTIFIER NOT NULL,
        WarehouseId UNIQUEIDENTIFIER NOT NULL,
        QuantityOnHand DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_inventory_ItemStocks_QuantityOnHand DEFAULT (0),
        QuantityReserved DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_inventory_ItemStocks_QuantityReserved DEFAULT (0),
        QuantityAvailable AS (QuantityOnHand - QuantityReserved) PERSISTED,
        AverageCost DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_inventory_ItemStocks_AverageCost DEFAULT (0),
        LastCost DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_inventory_ItemStocks_LastCost DEFAULT (0),
        StandardCost DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_inventory_ItemStocks_StandardCost DEFAULT (0),
        LastMovementAt DATETIME2(7) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_inventory_ItemStocks_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_inventory_ItemStocks_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_inventory_ItemStocks PRIMARY KEY (ItemStockId),
        CONSTRAINT FK_inventory_ItemStocks_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_inventory_ItemStocks_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_inventory_ItemStocks_Items FOREIGN KEY (ItemId)
            REFERENCES inventory.Items (ItemId),
        CONSTRAINT FK_inventory_ItemStocks_Warehouses FOREIGN KEY (WarehouseId)
            REFERENCES inventory.Warehouses (WarehouseId),
        CONSTRAINT CK_inventory_ItemStocks_QuantityOnHand CHECK (QuantityOnHand >= 0),
        CONSTRAINT CK_inventory_ItemStocks_QuantityReserved CHECK (QuantityReserved >= 0),
        CONSTRAINT CK_inventory_ItemStocks_QuantityReserved_OnHand CHECK (QuantityReserved <= QuantityOnHand),
        CONSTRAINT CK_inventory_ItemStocks_Costs CHECK (
            AverageCost >= 0
            AND LastCost >= 0
            AND StandardCost >= 0
        )
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.ItemStocks')
      AND name = 'UX_inventory_ItemStocks_Tenant_Company_Item_Warehouse'
)
BEGIN
    CREATE UNIQUE INDEX UX_inventory_ItemStocks_Tenant_Company_Item_Warehouse
        ON inventory.ItemStocks (TenantId, CompanyId, ItemId, WarehouseId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.ItemStocks')
      AND name = 'IX_inventory_ItemStocks_Tenant_Company_Warehouse'
)
BEGIN
    CREATE INDEX IX_inventory_ItemStocks_Tenant_Company_Warehouse
        ON inventory.ItemStocks (TenantId, CompanyId, WarehouseId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.ItemStocks')
      AND name = 'IX_inventory_ItemStocks_Tenant_Company_Item'
)
BEGIN
    CREATE INDEX IX_inventory_ItemStocks_Tenant_Company_Item
        ON inventory.ItemStocks (TenantId, CompanyId, ItemId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.ItemStocks')
      AND name = 'IX_inventory_ItemStocks_Tenant_Company_IsActive'
)
BEGIN
    CREATE INDEX IX_inventory_ItemStocks_Tenant_Company_IsActive
        ON inventory.ItemStocks (TenantId, CompanyId, IsActive);
END;
GO

CREATE OR ALTER VIEW inventory.V_ItemStockSummary
AS
SELECT
    stock.ItemStockId,
    stock.TenantId,
    stock.CompanyId,
    stock.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    stock.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    stock.QuantityOnHand,
    stock.QuantityReserved,
    stock.QuantityAvailable,
    stock.AverageCost,
    stock.LastCost,
    stock.StandardCost,
    stock.LastMovementAt,
    stock.IsActive,
    stock.CreatedAt,
    stock.UpdatedAt,
    stock.CreatedBy,
    stock.UpdatedBy
FROM inventory.ItemStocks stock
INNER JOIN inventory.Items item
    ON item.ItemId = stock.ItemId
INNER JOIN inventory.Warehouses warehouse
    ON warehouse.WarehouseId = stock.WarehouseId;
GO
