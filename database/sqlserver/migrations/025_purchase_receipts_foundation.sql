IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'purchasing')
BEGIN
    EXEC('CREATE SCHEMA purchasing');
END;
GO

IF OBJECT_ID('purchasing.PurchaseReceipts', 'U') IS NULL
BEGIN
    CREATE TABLE purchasing.PurchaseReceipts (
        PurchaseReceiptId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_purchasing_PurchaseReceipts_PurchaseReceiptId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        PurchaseReceiptNumber NVARCHAR(40) NOT NULL,
        PurchaseOrderId UNIQUEIDENTIFIER NOT NULL,
        SupplierId UNIQUEIDENTIFIER NOT NULL,
        InventoryMovementId UNIQUEIDENTIFIER NULL,
        ReceiptDate DATETIME2(7) NOT NULL
            CONSTRAINT DF_purchasing_PurchaseReceipts_ReceiptDate DEFAULT SYSUTCDATETIME(),
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_purchasing_PurchaseReceipts_Status DEFAULT 'DRAFT',
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(1000) NULL,
        PostedAt DATETIME2(7) NULL,
        PostedBy UNIQUEIDENTIFIER NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_purchasing_PurchaseReceipts_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_purchasing_PurchaseReceipts_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_purchasing_PurchaseReceipts PRIMARY KEY (PurchaseReceiptId),
        CONSTRAINT FK_purchasing_PurchaseReceipts_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_purchasing_PurchaseReceipts_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_purchasing_PurchaseReceipts_PurchaseOrders FOREIGN KEY (PurchaseOrderId)
            REFERENCES purchasing.PurchaseOrders (PurchaseOrderId),
        CONSTRAINT FK_purchasing_PurchaseReceipts_Suppliers FOREIGN KEY (SupplierId)
            REFERENCES purchasing.Suppliers (SupplierId),
        CONSTRAINT FK_purchasing_PurchaseReceipts_InventoryMovements FOREIGN KEY (InventoryMovementId)
            REFERENCES inventory.InventoryMovements (InventoryMovementId),
        CONSTRAINT CK_purchasing_PurchaseReceipts_Status CHECK (
            Status IN ('DRAFT', 'POSTED')
        )
    );
END;
GO

IF OBJECT_ID('purchasing.PurchaseReceiptLines', 'U') IS NULL
BEGIN
    CREATE TABLE purchasing.PurchaseReceiptLines (
        PurchaseReceiptLineId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_purchasing_PurchaseReceiptLines_PurchaseReceiptLineId DEFAULT NEWSEQUENTIALID(),
        PurchaseReceiptId UNIQUEIDENTIFIER NOT NULL,
        PurchaseOrderLineId UNIQUEIDENTIFIER NOT NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        LineNumber INT NOT NULL,
        ItemId UNIQUEIDENTIFIER NOT NULL,
        WarehouseId UNIQUEIDENTIFIER NOT NULL,
        UnitOfMeasureId UNIQUEIDENTIFIER NULL,
        QuantityReceived DECIMAL(18,6) NOT NULL,
        UnitCost DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_purchasing_PurchaseReceiptLines_UnitCost DEFAULT (0),
        LineTotal AS (QuantityReceived * UnitCost) PERSISTED,
        LotNumber NVARCHAR(100) NULL,
        SerialNumber NVARCHAR(100) NULL,
        ExpirationDate DATE NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_purchasing_PurchaseReceiptLines_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_purchasing_PurchaseReceiptLines PRIMARY KEY (PurchaseReceiptLineId),
        CONSTRAINT FK_purchasing_PurchaseReceiptLines_PurchaseReceipts FOREIGN KEY (PurchaseReceiptId)
            REFERENCES purchasing.PurchaseReceipts (PurchaseReceiptId),
        CONSTRAINT FK_purchasing_PurchaseReceiptLines_PurchaseOrderLines FOREIGN KEY (PurchaseOrderLineId)
            REFERENCES purchasing.PurchaseOrderLines (PurchaseOrderLineId),
        CONSTRAINT FK_purchasing_PurchaseReceiptLines_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_purchasing_PurchaseReceiptLines_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_purchasing_PurchaseReceiptLines_Items FOREIGN KEY (ItemId)
            REFERENCES inventory.Items (ItemId),
        CONSTRAINT FK_purchasing_PurchaseReceiptLines_Warehouses FOREIGN KEY (WarehouseId)
            REFERENCES inventory.Warehouses (WarehouseId),
        CONSTRAINT FK_purchasing_PurchaseReceiptLines_UnitsOfMeasure FOREIGN KEY (UnitOfMeasureId)
            REFERENCES core.UnitsOfMeasure (UnitOfMeasureId),
        CONSTRAINT CK_purchasing_PurchaseReceiptLines_Quantity CHECK (QuantityReceived > 0),
        CONSTRAINT CK_purchasing_PurchaseReceiptLines_UnitCost CHECK (UnitCost >= 0)
    );
END;
GO

IF OBJECT_ID('inventory.InventoryLedgerEntries', 'U') IS NOT NULL
   AND EXISTS (
       SELECT 1 FROM sys.check_constraints
       WHERE parent_object_id = OBJECT_ID('inventory.InventoryLedgerEntries')
         AND name = 'CK_inventory_InventoryLedgerEntries_MovementType'
   )
BEGIN
    ALTER TABLE inventory.InventoryLedgerEntries
        DROP CONSTRAINT CK_inventory_InventoryLedgerEntries_MovementType;
END;
GO

IF OBJECT_ID('inventory.InventoryLedgerEntries', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM sys.check_constraints
       WHERE parent_object_id = OBJECT_ID('inventory.InventoryLedgerEntries')
         AND name = 'CK_inventory_InventoryLedgerEntries_MovementType'
   )
BEGIN
    ALTER TABLE inventory.InventoryLedgerEntries
        ADD CONSTRAINT CK_inventory_InventoryLedgerEntries_MovementType CHECK (
            MovementType IN (
                'OPENING',
                'ADJUSTMENT_IN',
                'ADJUSTMENT_OUT',
                'TRANSFER',
                'PURCHASE_RECEIPT_PLACEHOLDER'
            )
        );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('purchasing.PurchaseReceipts')
      AND name = 'UX_purchasing_PurchaseReceipts_Tenant_Company_Number'
)
BEGIN
    CREATE UNIQUE INDEX UX_purchasing_PurchaseReceipts_Tenant_Company_Number
        ON purchasing.PurchaseReceipts (TenantId, CompanyId, PurchaseReceiptNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('purchasing.PurchaseReceipts')
      AND name = 'IX_purchasing_PurchaseReceipts_Tenant_Company_Order'
)
BEGIN
    CREATE INDEX IX_purchasing_PurchaseReceipts_Tenant_Company_Order
        ON purchasing.PurchaseReceipts (TenantId, CompanyId, PurchaseOrderId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('purchasing.PurchaseReceipts')
      AND name = 'IX_purchasing_PurchaseReceipts_Tenant_Company_Status'
)
BEGIN
    CREATE INDEX IX_purchasing_PurchaseReceipts_Tenant_Company_Status
        ON purchasing.PurchaseReceipts (TenantId, CompanyId, Status);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('purchasing.PurchaseReceiptLines')
      AND name = 'UX_purchasing_PurchaseReceiptLines_Receipt_Line'
)
BEGIN
    CREATE UNIQUE INDEX UX_purchasing_PurchaseReceiptLines_Receipt_Line
        ON purchasing.PurchaseReceiptLines (PurchaseReceiptId, LineNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('purchasing.PurchaseReceiptLines')
      AND name = 'UX_purchasing_PurchaseReceiptLines_Receipt_OrderLine'
)
BEGIN
    CREATE UNIQUE INDEX UX_purchasing_PurchaseReceiptLines_Receipt_OrderLine
        ON purchasing.PurchaseReceiptLines (PurchaseReceiptId, PurchaseOrderLineId);
END;
GO

CREATE OR ALTER VIEW purchasing.V_PurchaseReceiptSummary
AS
SELECT
    receipt.PurchaseReceiptId,
    receipt.TenantId,
    receipt.CompanyId,
    receipt.PurchaseReceiptNumber,
    receipt.PurchaseOrderId,
    purchaseOrder.PurchaseOrderNumber,
    receipt.SupplierId,
    supplier.Code AS SupplierCode,
    supplier.Name AS SupplierName,
    receipt.InventoryMovementId,
    movement.MovementNumber,
    receipt.ReceiptDate,
    receipt.Status,
    receipt.Reference,
    receipt.Notes,
    receipt.PostedAt,
    receipt.IsActive,
    receipt.CreatedAt,
    receipt.UpdatedAt,
    receipt.CreatedBy,
    receipt.UpdatedBy,
    COUNT(line.PurchaseReceiptLineId) AS LineCount,
    COALESCE(SUM(line.QuantityReceived), 0) AS TotalQuantityReceived,
    COALESCE(SUM(line.LineTotal), 0) AS TotalAmount
FROM purchasing.PurchaseReceipts receipt
INNER JOIN purchasing.PurchaseOrders purchaseOrder
    ON purchaseOrder.PurchaseOrderId = receipt.PurchaseOrderId
INNER JOIN purchasing.Suppliers supplier
    ON supplier.SupplierId = receipt.SupplierId
LEFT JOIN inventory.InventoryMovements movement
    ON movement.InventoryMovementId = receipt.InventoryMovementId
LEFT JOIN purchasing.PurchaseReceiptLines line
    ON line.PurchaseReceiptId = receipt.PurchaseReceiptId
GROUP BY
    receipt.PurchaseReceiptId,
    receipt.TenantId,
    receipt.CompanyId,
    receipt.PurchaseReceiptNumber,
    receipt.PurchaseOrderId,
    purchaseOrder.PurchaseOrderNumber,
    receipt.SupplierId,
    supplier.Code,
    supplier.Name,
    receipt.InventoryMovementId,
    movement.MovementNumber,
    receipt.ReceiptDate,
    receipt.Status,
    receipt.Reference,
    receipt.Notes,
    receipt.PostedAt,
    receipt.IsActive,
    receipt.CreatedAt,
    receipt.UpdatedAt,
    receipt.CreatedBy,
    receipt.UpdatedBy;
GO

CREATE OR ALTER VIEW purchasing.V_PurchaseReceiptLineSummary
AS
SELECT
    line.PurchaseReceiptLineId,
    line.PurchaseReceiptId,
    receipt.PurchaseReceiptNumber,
    receipt.PurchaseOrderId,
    purchaseOrder.PurchaseOrderNumber,
    line.PurchaseOrderLineId,
    line.TenantId,
    line.CompanyId,
    receipt.SupplierId,
    supplier.Code AS SupplierCode,
    supplier.Name AS SupplierName,
    receipt.Status,
    receipt.ReceiptDate,
    receipt.InventoryMovementId,
    movement.MovementNumber,
    line.LineNumber,
    line.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    line.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    line.UnitOfMeasureId,
    unit.Code AS UnitOfMeasureCode,
    unit.Name AS UnitOfMeasureName,
    line.QuantityReceived,
    purchaseOrderLine.Quantity AS OrderedQuantity,
    line.UnitCost,
    line.LineTotal,
    line.LotNumber,
    line.SerialNumber,
    line.ExpirationDate,
    line.Notes,
    receipt.IsActive,
    line.CreatedAt,
    line.UpdatedAt,
    line.CreatedBy,
    line.UpdatedBy
FROM purchasing.PurchaseReceiptLines line
INNER JOIN purchasing.PurchaseReceipts receipt
    ON receipt.PurchaseReceiptId = line.PurchaseReceiptId
INNER JOIN purchasing.PurchaseOrders purchaseOrder
    ON purchaseOrder.PurchaseOrderId = receipt.PurchaseOrderId
INNER JOIN purchasing.PurchaseOrderLines purchaseOrderLine
    ON purchaseOrderLine.PurchaseOrderLineId = line.PurchaseOrderLineId
INNER JOIN purchasing.Suppliers supplier
    ON supplier.SupplierId = receipt.SupplierId
INNER JOIN inventory.Items item
    ON item.ItemId = line.ItemId
INNER JOIN inventory.Warehouses warehouse
    ON warehouse.WarehouseId = line.WarehouseId
LEFT JOIN inventory.InventoryMovements movement
    ON movement.InventoryMovementId = receipt.InventoryMovementId
LEFT JOIN core.UnitsOfMeasure unit
    ON unit.UnitOfMeasureId = line.UnitOfMeasureId;
GO
