IF SCHEMA_ID('sales') IS NULL
BEGIN
    EXEC('CREATE SCHEMA sales');
END;
GO

IF OBJECT_ID('sales.SalesOrders', 'U') IS NULL
BEGIN
    CREATE TABLE sales.SalesOrders (
        SalesOrderId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_sales_SalesOrders_SalesOrderId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        OrderNumber NVARCHAR(40) NOT NULL,
        SourceQuotationId UNIQUEIDENTIFIER NULL,
        SourceQuotationNumber NVARCHAR(40) NULL,
        CustomerId UNIQUEIDENTIFIER NOT NULL,
        OrderDate DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesOrders_OrderDate DEFAULT SYSUTCDATETIME(),
        RequestedDeliveryDate DATETIME2(7) NULL,
        CurrencyCode NVARCHAR(3) NOT NULL,
        ExchangeRate DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_sales_SalesOrders_ExchangeRate DEFAULT (1),
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_sales_SalesOrders_Status DEFAULT 'DRAFT',
        SubtotalAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesOrders_SubtotalAmount DEFAULT (0),
        DiscountAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesOrders_DiscountAmount DEFAULT (0),
        TaxAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesOrders_TaxAmount DEFAULT (0),
        TotalAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesOrders_TotalAmount DEFAULT (0),
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(1000) NULL,
        SubmittedAt DATETIME2(7) NULL,
        SubmittedBy UNIQUEIDENTIFIER NULL,
        ApprovedAt DATETIME2(7) NULL,
        ApprovedBy UNIQUEIDENTIFIER NULL,
        RejectedAt DATETIME2(7) NULL,
        RejectedBy UNIQUEIDENTIFIER NULL,
        CancelledAt DATETIME2(7) NULL,
        CancelledBy UNIQUEIDENTIFIER NULL,
        CancellationReason NVARCHAR(500) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_sales_SalesOrders_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesOrders_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_sales_SalesOrders PRIMARY KEY (SalesOrderId),
        CONSTRAINT FK_sales_SalesOrders_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_sales_SalesOrders_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_sales_SalesOrders_Customers FOREIGN KEY (CustomerId)
            REFERENCES crm.Customers (CustomerId),
        CONSTRAINT FK_sales_SalesOrders_SourceQuotations FOREIGN KEY (SourceQuotationId)
            REFERENCES sales.SalesQuotations (SalesQuotationId),
        CONSTRAINT CK_sales_SalesOrders_Status CHECK (
            Status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED')
        ),
        CONSTRAINT CK_sales_SalesOrders_ExchangeRate CHECK (ExchangeRate > 0),
        CONSTRAINT CK_sales_SalesOrders_Dates CHECK (
            RequestedDeliveryDate IS NULL OR RequestedDeliveryDate >= OrderDate
        ),
        CONSTRAINT CK_sales_SalesOrders_Amounts CHECK (
            SubtotalAmount >= 0 AND DiscountAmount >= 0 AND TaxAmount >= 0 AND TotalAmount >= 0
        )
    );
END;
GO

IF OBJECT_ID('sales.SalesOrderLines', 'U') IS NULL
BEGIN
    CREATE TABLE sales.SalesOrderLines (
        SalesOrderLineId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_sales_SalesOrderLines_SalesOrderLineId DEFAULT NEWSEQUENTIALID(),
        SalesOrderId UNIQUEIDENTIFIER NOT NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        SourceQuotationLineId UNIQUEIDENTIFIER NULL,
        LineNumber INT NOT NULL,
        ItemId UNIQUEIDENTIFIER NOT NULL,
        UnitOfMeasureId UNIQUEIDENTIFIER NOT NULL,
        WarehouseId UNIQUEIDENTIFIER NULL,
        Description NVARCHAR(300) NOT NULL,
        Quantity DECIMAL(18,4) NOT NULL,
        UnitPrice DECIMAL(18,4) NOT NULL,
        DiscountPercent DECIMAL(9,4) NOT NULL
            CONSTRAINT DF_sales_SalesOrderLines_DiscountPercent DEFAULT (0),
        DiscountAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesOrderLines_DiscountAmount DEFAULT (0),
        TaxPercent DECIMAL(9,4) NOT NULL
            CONSTRAINT DF_sales_SalesOrderLines_TaxPercent DEFAULT (0),
        TaxAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesOrderLines_TaxAmount DEFAULT (0),
        LineSubtotal DECIMAL(18,4) NOT NULL,
        LineTotal DECIMAL(18,4) NOT NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesOrderLines_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_sales_SalesOrderLines PRIMARY KEY (SalesOrderLineId),
        CONSTRAINT FK_sales_SalesOrderLines_SalesOrders FOREIGN KEY (SalesOrderId)
            REFERENCES sales.SalesOrders (SalesOrderId),
        CONSTRAINT FK_sales_SalesOrderLines_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_sales_SalesOrderLines_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_sales_SalesOrderLines_SourceQuotationLines FOREIGN KEY (SourceQuotationLineId)
            REFERENCES sales.SalesQuotationLines (SalesQuotationLineId),
        CONSTRAINT FK_sales_SalesOrderLines_Items FOREIGN KEY (ItemId)
            REFERENCES inventory.Items (ItemId),
        CONSTRAINT FK_sales_SalesOrderLines_UnitsOfMeasure FOREIGN KEY (UnitOfMeasureId)
            REFERENCES core.UnitsOfMeasure (UnitOfMeasureId),
        CONSTRAINT FK_sales_SalesOrderLines_Warehouses FOREIGN KEY (WarehouseId)
            REFERENCES inventory.Warehouses (WarehouseId),
        CONSTRAINT CK_sales_SalesOrderLines_Quantity CHECK (Quantity > 0),
        CONSTRAINT CK_sales_SalesOrderLines_UnitPrice CHECK (UnitPrice >= 0),
        CONSTRAINT CK_sales_SalesOrderLines_DiscountPercent CHECK (DiscountPercent >= 0 AND DiscountPercent <= 100),
        CONSTRAINT CK_sales_SalesOrderLines_TaxPercent CHECK (TaxPercent >= 0 AND TaxPercent <= 100),
        CONSTRAINT CK_sales_SalesOrderLines_Amounts CHECK (
            DiscountAmount >= 0 AND TaxAmount >= 0 AND LineSubtotal >= 0 AND LineTotal >= 0
        )
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('sales.SalesOrders')
      AND name = 'UX_sales_SalesOrders_Tenant_Company_Number'
)
BEGIN
    CREATE UNIQUE INDEX UX_sales_SalesOrders_Tenant_Company_Number
        ON sales.SalesOrders (TenantId, CompanyId, OrderNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('sales.SalesOrders')
      AND name = 'UX_sales_SalesOrders_SourceQuotation'
)
BEGIN
    CREATE UNIQUE INDEX UX_sales_SalesOrders_SourceQuotation
        ON sales.SalesOrders (TenantId, CompanyId, SourceQuotationId)
        WHERE SourceQuotationId IS NOT NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('sales.SalesOrders')
      AND name = 'IX_sales_SalesOrders_Tenant_Company_Customer'
)
BEGIN
    CREATE INDEX IX_sales_SalesOrders_Tenant_Company_Customer
        ON sales.SalesOrders (TenantId, CompanyId, CustomerId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('sales.SalesOrders')
      AND name = 'IX_sales_SalesOrders_Tenant_Company_Status'
)
BEGIN
    CREATE INDEX IX_sales_SalesOrders_Tenant_Company_Status
        ON sales.SalesOrders (TenantId, CompanyId, Status);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('sales.SalesOrders')
      AND name = 'IX_sales_SalesOrders_Tenant_Company_Dates'
)
BEGIN
    CREATE INDEX IX_sales_SalesOrders_Tenant_Company_Dates
        ON sales.SalesOrders (TenantId, CompanyId, OrderDate, RequestedDeliveryDate);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('sales.SalesOrderLines')
      AND name = 'UX_sales_SalesOrderLines_Order_Line'
)
BEGIN
    CREATE UNIQUE INDEX UX_sales_SalesOrderLines_Order_Line
        ON sales.SalesOrderLines (SalesOrderId, LineNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('sales.SalesOrderLines')
      AND name = 'IX_sales_SalesOrderLines_Tenant_Company_Item'
)
BEGIN
    CREATE INDEX IX_sales_SalesOrderLines_Tenant_Company_Item
        ON sales.SalesOrderLines (TenantId, CompanyId, ItemId);
END;
GO

CREATE OR ALTER VIEW sales.V_SalesOrderSummary
AS
SELECT
    salesOrder.SalesOrderId,
    salesOrder.TenantId,
    salesOrder.CompanyId,
    salesOrder.OrderNumber,
    salesOrder.SourceQuotationId,
    salesOrder.SourceQuotationNumber,
    salesOrder.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    salesOrder.OrderDate,
    salesOrder.RequestedDeliveryDate,
    salesOrder.CurrencyCode,
    salesOrder.ExchangeRate,
    salesOrder.Status,
    salesOrder.SubtotalAmount,
    salesOrder.DiscountAmount,
    salesOrder.TaxAmount,
    salesOrder.TotalAmount,
    COUNT(line.SalesOrderLineId) AS LineCount,
    salesOrder.Reference,
    salesOrder.Notes,
    salesOrder.SubmittedAt,
    salesOrder.ApprovedAt,
    salesOrder.RejectedAt,
    salesOrder.CancelledAt,
    salesOrder.CancellationReason,
    salesOrder.IsActive,
    salesOrder.CreatedAt,
    salesOrder.UpdatedAt,
    salesOrder.CreatedBy,
    salesOrder.UpdatedBy
FROM sales.SalesOrders salesOrder
INNER JOIN crm.Customers customer
    ON customer.CustomerId = salesOrder.CustomerId
LEFT JOIN sales.SalesOrderLines line
    ON line.SalesOrderId = salesOrder.SalesOrderId
GROUP BY
    salesOrder.SalesOrderId,
    salesOrder.TenantId,
    salesOrder.CompanyId,
    salesOrder.OrderNumber,
    salesOrder.SourceQuotationId,
    salesOrder.SourceQuotationNumber,
    salesOrder.CustomerId,
    customer.Code,
    customer.Name,
    salesOrder.OrderDate,
    salesOrder.RequestedDeliveryDate,
    salesOrder.CurrencyCode,
    salesOrder.ExchangeRate,
    salesOrder.Status,
    salesOrder.SubtotalAmount,
    salesOrder.DiscountAmount,
    salesOrder.TaxAmount,
    salesOrder.TotalAmount,
    salesOrder.Reference,
    salesOrder.Notes,
    salesOrder.SubmittedAt,
    salesOrder.ApprovedAt,
    salesOrder.RejectedAt,
    salesOrder.CancelledAt,
    salesOrder.CancellationReason,
    salesOrder.IsActive,
    salesOrder.CreatedAt,
    salesOrder.UpdatedAt,
    salesOrder.CreatedBy,
    salesOrder.UpdatedBy;
GO

CREATE OR ALTER VIEW sales.V_SalesOrderLineSummary
AS
SELECT
    line.SalesOrderLineId,
    line.SalesOrderId,
    line.TenantId,
    line.CompanyId,
    salesOrder.OrderNumber,
    salesOrder.SourceQuotationId,
    salesOrder.SourceQuotationNumber,
    line.SourceQuotationLineId,
    salesOrder.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    salesOrder.Status,
    salesOrder.OrderDate,
    salesOrder.RequestedDeliveryDate,
    line.LineNumber,
    line.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    line.UnitOfMeasureId,
    unit.Code AS UnitOfMeasureCode,
    unit.Name AS UnitOfMeasureName,
    line.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    line.Description,
    line.Quantity,
    line.UnitPrice,
    line.DiscountPercent,
    line.DiscountAmount,
    line.TaxPercent,
    line.TaxAmount,
    line.LineSubtotal,
    line.LineTotal,
    line.Notes,
    salesOrder.IsActive,
    line.CreatedAt,
    line.UpdatedAt,
    line.CreatedBy,
    line.UpdatedBy
FROM sales.SalesOrderLines line
INNER JOIN sales.SalesOrders salesOrder
    ON salesOrder.SalesOrderId = line.SalesOrderId
INNER JOIN crm.Customers customer
    ON customer.CustomerId = salesOrder.CustomerId
INNER JOIN inventory.Items item
    ON item.ItemId = line.ItemId
INNER JOIN core.UnitsOfMeasure unit
    ON unit.UnitOfMeasureId = line.UnitOfMeasureId
LEFT JOIN inventory.Warehouses warehouse
    ON warehouse.WarehouseId = line.WarehouseId;
GO
