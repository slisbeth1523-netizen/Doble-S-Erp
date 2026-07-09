IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'purchasing')
BEGIN
    EXEC('CREATE SCHEMA purchasing');
END;
GO

IF OBJECT_ID('purchasing.PurchaseOrders', 'U') IS NULL
BEGIN
    CREATE TABLE purchasing.PurchaseOrders (
        PurchaseOrderId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_purchasing_PurchaseOrders_PurchaseOrderId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        PurchaseOrderNumber NVARCHAR(40) NOT NULL,
        SupplierId UNIQUEIDENTIFIER NOT NULL,
        OrderDate DATETIME2(7) NOT NULL
            CONSTRAINT DF_purchasing_PurchaseOrders_OrderDate DEFAULT SYSUTCDATETIME(),
        ExpectedDate DATE NULL,
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_purchasing_PurchaseOrders_Status DEFAULT 'DRAFT',
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(1000) NULL,
        ApprovedAt DATETIME2(7) NULL,
        ApprovedBy UNIQUEIDENTIFIER NULL,
        CancelledAt DATETIME2(7) NULL,
        CancelledBy UNIQUEIDENTIFIER NULL,
        CancellationReason NVARCHAR(500) NULL,
        ClosedAt DATETIME2(7) NULL,
        ClosedBy UNIQUEIDENTIFIER NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_purchasing_PurchaseOrders_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_purchasing_PurchaseOrders_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_purchasing_PurchaseOrders PRIMARY KEY (PurchaseOrderId),
        CONSTRAINT FK_purchasing_PurchaseOrders_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_purchasing_PurchaseOrders_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_purchasing_PurchaseOrders_Suppliers FOREIGN KEY (SupplierId)
            REFERENCES purchasing.Suppliers (SupplierId),
        CONSTRAINT CK_purchasing_PurchaseOrders_Status CHECK (
            Status IN ('DRAFT', 'APPROVED', 'CANCELLED', 'CLOSED')
        )
    );
END;
GO

IF OBJECT_ID('purchasing.PurchaseOrderLines', 'U') IS NULL
BEGIN
    CREATE TABLE purchasing.PurchaseOrderLines (
        PurchaseOrderLineId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_purchasing_PurchaseOrderLines_PurchaseOrderLineId DEFAULT NEWSEQUENTIALID(),
        PurchaseOrderId UNIQUEIDENTIFIER NOT NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        LineNumber INT NOT NULL,
        ItemId UNIQUEIDENTIFIER NOT NULL,
        WarehouseId UNIQUEIDENTIFIER NOT NULL,
        UnitOfMeasureId UNIQUEIDENTIFIER NULL,
        Quantity DECIMAL(18,6) NOT NULL,
        UnitCost DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_purchasing_PurchaseOrderLines_UnitCost DEFAULT (0),
        DiscountAmount DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_purchasing_PurchaseOrderLines_DiscountAmount DEFAULT (0),
        TaxAmount DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_purchasing_PurchaseOrderLines_TaxAmount DEFAULT (0),
        LineSubtotal AS (Quantity * UnitCost) PERSISTED,
        LineTotal AS ((Quantity * UnitCost) - DiscountAmount + TaxAmount) PERSISTED,
        ExpectedDate DATE NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_purchasing_PurchaseOrderLines_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_purchasing_PurchaseOrderLines PRIMARY KEY (PurchaseOrderLineId),
        CONSTRAINT FK_purchasing_PurchaseOrderLines_PurchaseOrders FOREIGN KEY (PurchaseOrderId)
            REFERENCES purchasing.PurchaseOrders (PurchaseOrderId),
        CONSTRAINT FK_purchasing_PurchaseOrderLines_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_purchasing_PurchaseOrderLines_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_purchasing_PurchaseOrderLines_Items FOREIGN KEY (ItemId)
            REFERENCES inventory.Items (ItemId),
        CONSTRAINT FK_purchasing_PurchaseOrderLines_Warehouses FOREIGN KEY (WarehouseId)
            REFERENCES inventory.Warehouses (WarehouseId),
        CONSTRAINT FK_purchasing_PurchaseOrderLines_UnitsOfMeasure FOREIGN KEY (UnitOfMeasureId)
            REFERENCES core.UnitsOfMeasure (UnitOfMeasureId),
        CONSTRAINT CK_purchasing_PurchaseOrderLines_Quantity CHECK (Quantity > 0),
        CONSTRAINT CK_purchasing_PurchaseOrderLines_Amounts CHECK (
            UnitCost >= 0 AND DiscountAmount >= 0 AND TaxAmount >= 0
        ),
        CONSTRAINT CK_purchasing_PurchaseOrderLines_Total CHECK (
            ((Quantity * UnitCost) - DiscountAmount + TaxAmount) >= 0
        )
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('purchasing.PurchaseOrders')
      AND name = 'UX_purchasing_PurchaseOrders_Tenant_Company_Number'
)
BEGIN
    CREATE UNIQUE INDEX UX_purchasing_PurchaseOrders_Tenant_Company_Number
        ON purchasing.PurchaseOrders (TenantId, CompanyId, PurchaseOrderNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('purchasing.PurchaseOrders')
      AND name = 'IX_purchasing_PurchaseOrders_Tenant_Company_Status'
)
BEGIN
    CREATE INDEX IX_purchasing_PurchaseOrders_Tenant_Company_Status
        ON purchasing.PurchaseOrders (TenantId, CompanyId, Status);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('purchasing.PurchaseOrders')
      AND name = 'IX_purchasing_PurchaseOrders_Tenant_Company_Supplier'
)
BEGIN
    CREATE INDEX IX_purchasing_PurchaseOrders_Tenant_Company_Supplier
        ON purchasing.PurchaseOrders (TenantId, CompanyId, SupplierId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('purchasing.PurchaseOrderLines')
      AND name = 'UX_purchasing_PurchaseOrderLines_Order_Line'
)
BEGIN
    CREATE UNIQUE INDEX UX_purchasing_PurchaseOrderLines_Order_Line
        ON purchasing.PurchaseOrderLines (PurchaseOrderId, LineNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('purchasing.PurchaseOrderLines')
      AND name = 'IX_purchasing_PurchaseOrderLines_Tenant_Company_Item'
)
BEGIN
    CREATE INDEX IX_purchasing_PurchaseOrderLines_Tenant_Company_Item
        ON purchasing.PurchaseOrderLines (TenantId, CompanyId, ItemId);
END;
GO

CREATE OR ALTER VIEW purchasing.V_PurchaseOrderSummary
AS
SELECT
    purchaseOrder.PurchaseOrderId,
    purchaseOrder.TenantId,
    purchaseOrder.CompanyId,
    purchaseOrder.PurchaseOrderNumber,
    purchaseOrder.SupplierId,
    supplier.Code AS SupplierCode,
    supplier.Name AS SupplierName,
    purchaseOrder.OrderDate,
    purchaseOrder.ExpectedDate,
    purchaseOrder.Status,
    purchaseOrder.Reference,
    purchaseOrder.Notes,
    purchaseOrder.ApprovedAt,
    purchaseOrder.CancelledAt,
    purchaseOrder.CancellationReason,
    purchaseOrder.ClosedAt,
    purchaseOrder.IsActive,
    purchaseOrder.CreatedAt,
    purchaseOrder.UpdatedAt,
    purchaseOrder.CreatedBy,
    purchaseOrder.UpdatedBy,
    COUNT(line.PurchaseOrderLineId) AS LineCount,
    COALESCE(SUM(line.Quantity), 0) AS TotalQuantity,
    COALESCE(SUM(line.LineSubtotal), 0) AS SubtotalAmount,
    COALESCE(SUM(line.DiscountAmount), 0) AS DiscountAmount,
    COALESCE(SUM(line.TaxAmount), 0) AS TaxAmount,
    COALESCE(SUM(line.LineTotal), 0) AS TotalAmount
FROM purchasing.PurchaseOrders purchaseOrder
INNER JOIN purchasing.Suppliers supplier
    ON supplier.SupplierId = purchaseOrder.SupplierId
LEFT JOIN purchasing.PurchaseOrderLines line
    ON line.PurchaseOrderId = purchaseOrder.PurchaseOrderId
GROUP BY
    purchaseOrder.PurchaseOrderId,
    purchaseOrder.TenantId,
    purchaseOrder.CompanyId,
    purchaseOrder.PurchaseOrderNumber,
    purchaseOrder.SupplierId,
    supplier.Code,
    supplier.Name,
    purchaseOrder.OrderDate,
    purchaseOrder.ExpectedDate,
    purchaseOrder.Status,
    purchaseOrder.Reference,
    purchaseOrder.Notes,
    purchaseOrder.ApprovedAt,
    purchaseOrder.CancelledAt,
    purchaseOrder.CancellationReason,
    purchaseOrder.ClosedAt,
    purchaseOrder.IsActive,
    purchaseOrder.CreatedAt,
    purchaseOrder.UpdatedAt,
    purchaseOrder.CreatedBy,
    purchaseOrder.UpdatedBy;
GO

CREATE OR ALTER VIEW purchasing.V_PurchaseOrderLineSummary
AS
SELECT
    line.PurchaseOrderLineId,
    line.PurchaseOrderId,
    line.TenantId,
    line.CompanyId,
    purchaseOrder.PurchaseOrderNumber,
    purchaseOrder.SupplierId,
    supplier.Code AS SupplierCode,
    supplier.Name AS SupplierName,
    purchaseOrder.Status,
    purchaseOrder.OrderDate,
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
    line.Quantity,
    line.UnitCost,
    line.DiscountAmount,
    line.TaxAmount,
    line.LineSubtotal,
    line.LineTotal,
    line.ExpectedDate,
    line.Notes,
    purchaseOrder.IsActive,
    line.CreatedAt,
    line.UpdatedAt,
    line.CreatedBy,
    line.UpdatedBy
FROM purchasing.PurchaseOrderLines line
INNER JOIN purchasing.PurchaseOrders purchaseOrder
    ON purchaseOrder.PurchaseOrderId = line.PurchaseOrderId
INNER JOIN purchasing.Suppliers supplier
    ON supplier.SupplierId = purchaseOrder.SupplierId
INNER JOIN inventory.Items item
    ON item.ItemId = line.ItemId
INNER JOIN inventory.Warehouses warehouse
    ON warehouse.WarehouseId = line.WarehouseId
LEFT JOIN core.UnitsOfMeasure unit
    ON unit.UnitOfMeasureId = line.UnitOfMeasureId;
GO
