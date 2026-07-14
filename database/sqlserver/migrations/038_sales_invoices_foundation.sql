IF OBJECT_ID('sales.SalesInvoices', 'U') IS NULL
BEGIN
    CREATE TABLE sales.SalesInvoices (
        SalesInvoiceId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_sales_SalesInvoices_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        InvoiceNumber NVARCHAR(40) NOT NULL,
        SalesOrderId UNIQUEIDENTIFIER NOT NULL,
        CustomerId UNIQUEIDENTIFIER NOT NULL,
        InvoiceDate DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesInvoices_InvoiceDate DEFAULT SYSUTCDATETIME(),
        DueDate DATETIME2(7) NOT NULL,
        CurrencyCode NVARCHAR(3) NOT NULL,
        ExchangeRate DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_sales_SalesInvoices_ExchangeRate DEFAULT (1),
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_sales_SalesInvoices_Status DEFAULT 'DRAFT',
        SubtotalAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesInvoices_SubtotalAmount DEFAULT (0),
        DiscountAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesInvoices_DiscountAmount DEFAULT (0),
        TaxAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesInvoices_TaxAmount DEFAULT (0),
        TotalAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesInvoices_TotalAmount DEFAULT (0),
        AccountsReceivableDocumentId UNIQUEIDENTIFIER NULL,
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(1000) NULL,
        PostedAt DATETIME2(7) NULL,
        PostedBy UNIQUEIDENTIFIER NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_sales_SalesInvoices_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesInvoices_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_sales_SalesInvoices PRIMARY KEY (SalesInvoiceId),
        CONSTRAINT FK_sales_SalesInvoices_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_sales_SalesInvoices_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_sales_SalesInvoices_SalesOrders FOREIGN KEY (SalesOrderId)
            REFERENCES sales.SalesOrders (SalesOrderId),
        CONSTRAINT FK_sales_SalesInvoices_Customers FOREIGN KEY (CustomerId)
            REFERENCES crm.Customers (CustomerId),
        CONSTRAINT FK_sales_SalesInvoices_ARDocuments FOREIGN KEY (AccountsReceivableDocumentId)
            REFERENCES ar.AccountsReceivableDocuments (AccountsReceivableDocumentId),
        CONSTRAINT CK_sales_SalesInvoices_Status CHECK (Status IN ('DRAFT', 'POSTED', 'CANCELLED')),
        CONSTRAINT CK_sales_SalesInvoices_ExchangeRate CHECK (ExchangeRate > 0),
        CONSTRAINT CK_sales_SalesInvoices_Dates CHECK (DueDate >= InvoiceDate),
        CONSTRAINT CK_sales_SalesInvoices_Amounts CHECK (
            SubtotalAmount >= 0 AND DiscountAmount >= 0 AND TaxAmount >= 0 AND TotalAmount >= 0
        )
    );
END;
GO

IF OBJECT_ID('sales.SalesInvoiceLines', 'U') IS NULL
BEGIN
    CREATE TABLE sales.SalesInvoiceLines (
        SalesInvoiceLineId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_sales_SalesInvoiceLines_Id DEFAULT NEWSEQUENTIALID(),
        SalesInvoiceId UNIQUEIDENTIFIER NOT NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        SalesOrderLineId UNIQUEIDENTIFIER NOT NULL,
        SalesShipmentId UNIQUEIDENTIFIER NOT NULL,
        SalesShipmentLineId UNIQUEIDENTIFIER NOT NULL,
        LineNumber INT NOT NULL,
        ItemId UNIQUEIDENTIFIER NOT NULL,
        UnitOfMeasureId UNIQUEIDENTIFIER NOT NULL,
        Quantity DECIMAL(18,4) NOT NULL,
        UnitPrice DECIMAL(18,4) NOT NULL,
        DiscountPercent DECIMAL(9,4) NOT NULL
            CONSTRAINT DF_sales_SalesInvoiceLines_DiscountPercent DEFAULT (0),
        DiscountAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesInvoiceLines_DiscountAmount DEFAULT (0),
        TaxPercent DECIMAL(9,4) NOT NULL
            CONSTRAINT DF_sales_SalesInvoiceLines_TaxPercent DEFAULT (0),
        TaxAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesInvoiceLines_TaxAmount DEFAULT (0),
        LineSubtotal DECIMAL(18,4) NOT NULL,
        LineTotal DECIMAL(18,4) NOT NULL,
        Description NVARCHAR(300) NOT NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesInvoiceLines_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_sales_SalesInvoiceLines PRIMARY KEY (SalesInvoiceLineId),
        CONSTRAINT FK_sales_SalesInvoiceLines_SalesInvoices FOREIGN KEY (SalesInvoiceId)
            REFERENCES sales.SalesInvoices (SalesInvoiceId),
        CONSTRAINT FK_sales_SalesInvoiceLines_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_sales_SalesInvoiceLines_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_sales_SalesInvoiceLines_SalesOrderLines FOREIGN KEY (SalesOrderLineId)
            REFERENCES sales.SalesOrderLines (SalesOrderLineId),
        CONSTRAINT FK_sales_SalesInvoiceLines_SalesShipments FOREIGN KEY (SalesShipmentId)
            REFERENCES sales.SalesShipments (SalesShipmentId),
        CONSTRAINT FK_sales_SalesInvoiceLines_SalesShipmentLines FOREIGN KEY (SalesShipmentLineId)
            REFERENCES sales.SalesShipmentLines (SalesShipmentLineId),
        CONSTRAINT FK_sales_SalesInvoiceLines_Items FOREIGN KEY (ItemId)
            REFERENCES inventory.Items (ItemId),
        CONSTRAINT FK_sales_SalesInvoiceLines_UnitsOfMeasure FOREIGN KEY (UnitOfMeasureId)
            REFERENCES core.UnitsOfMeasure (UnitOfMeasureId),
        CONSTRAINT CK_sales_SalesInvoiceLines_Quantity CHECK (Quantity > 0),
        CONSTRAINT CK_sales_SalesInvoiceLines_UnitPrice CHECK (UnitPrice >= 0),
        CONSTRAINT CK_sales_SalesInvoiceLines_DiscountPercent CHECK (DiscountPercent >= 0 AND DiscountPercent <= 100),
        CONSTRAINT CK_sales_SalesInvoiceLines_TaxPercent CHECK (TaxPercent >= 0 AND TaxPercent <= 100),
        CONSTRAINT CK_sales_SalesInvoiceLines_Amounts CHECK (
            DiscountAmount >= 0 AND TaxAmount >= 0 AND LineSubtotal >= 0 AND LineTotal >= 0
        )
    );
END;
GO

IF OBJECT_ID('sales.SalesInvoiceOperations', 'U') IS NULL
BEGIN
    CREATE TABLE sales.SalesInvoiceOperations (
        SalesInvoiceOperationId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_sales_SalesInvoiceOperations_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        SalesInvoiceId UNIQUEIDENTIFIER NOT NULL,
        OperationType NVARCHAR(20) NOT NULL,
        IdempotencyKey NVARCHAR(120) NOT NULL,
        RequestHash NVARCHAR(128) NOT NULL,
        ResultStatus NVARCHAR(20) NOT NULL,
        AccountsReceivableDocumentId UNIQUEIDENTIFIER NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesInvoiceOperations_CreatedAt DEFAULT SYSUTCDATETIME(),
        CreatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_sales_SalesInvoiceOperations PRIMARY KEY (SalesInvoiceOperationId),
        CONSTRAINT FK_sales_SalesInvoiceOperations_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_sales_SalesInvoiceOperations_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_sales_SalesInvoiceOperations_SalesInvoices FOREIGN KEY (SalesInvoiceId)
            REFERENCES sales.SalesInvoices (SalesInvoiceId),
        CONSTRAINT FK_sales_SalesInvoiceOperations_ARDocuments FOREIGN KEY (AccountsReceivableDocumentId)
            REFERENCES ar.AccountsReceivableDocuments (AccountsReceivableDocumentId),
        CONSTRAINT CK_sales_SalesInvoiceOperations_Type CHECK (OperationType IN ('POST')),
        CONSTRAINT CK_sales_SalesInvoiceOperations_Status CHECK (ResultStatus IN ('POSTED'))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesInvoices') AND name = 'UX_sales_SalesInvoices_Number')
BEGIN
    CREATE UNIQUE INDEX UX_sales_SalesInvoices_Number
        ON sales.SalesInvoices (TenantId, CompanyId, InvoiceNumber);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesInvoices') AND name = 'UX_sales_SalesInvoices_ARDocument')
BEGIN
    CREATE UNIQUE INDEX UX_sales_SalesInvoices_ARDocument
        ON sales.SalesInvoices (TenantId, CompanyId, AccountsReceivableDocumentId)
        WHERE AccountsReceivableDocumentId IS NOT NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('ar.AccountsReceivableDocuments') AND name = 'UX_ar_AccountsReceivableDocuments_SalesInvoiceSource')
BEGIN
    CREATE UNIQUE INDEX UX_ar_AccountsReceivableDocuments_SalesInvoiceSource
        ON ar.AccountsReceivableDocuments (TenantId, CompanyId, SourceType, SourceDocumentId)
        WHERE SourceType = 'SALES_INVOICE' AND SourceDocumentId IS NOT NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesInvoices') AND name = 'IX_sales_SalesInvoices_Customer')
BEGIN
    CREATE INDEX IX_sales_SalesInvoices_Customer
        ON sales.SalesInvoices (TenantId, CompanyId, CustomerId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesInvoices') AND name = 'IX_sales_SalesInvoices_Order_Status')
BEGIN
    CREATE INDEX IX_sales_SalesInvoices_Order_Status
        ON sales.SalesInvoices (TenantId, CompanyId, SalesOrderId, Status);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesInvoices') AND name = 'IX_sales_SalesInvoices_Dates')
BEGIN
    CREATE INDEX IX_sales_SalesInvoices_Dates
        ON sales.SalesInvoices (TenantId, CompanyId, InvoiceDate, DueDate);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesInvoiceLines') AND name = 'UX_sales_SalesInvoiceLines_Invoice_Line')
BEGIN
    CREATE UNIQUE INDEX UX_sales_SalesInvoiceLines_Invoice_Line
        ON sales.SalesInvoiceLines (SalesInvoiceId, LineNumber);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesInvoiceLines') AND name = 'IX_sales_SalesInvoiceLines_ShipmentLine')
BEGIN
    CREATE INDEX IX_sales_SalesInvoiceLines_ShipmentLine
        ON sales.SalesInvoiceLines (TenantId, CompanyId, SalesShipmentLineId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesInvoiceOperations') AND name = 'UX_sales_SalesInvoiceOperations_Key')
BEGIN
    CREATE UNIQUE INDEX UX_sales_SalesInvoiceOperations_Key
        ON sales.SalesInvoiceOperations (TenantId, CompanyId, OperationType, IdempotencyKey);
END;
GO

CREATE OR ALTER VIEW sales.V_SalesInvoiceSummary
AS
SELECT
    invoice.SalesInvoiceId,
    invoice.TenantId,
    invoice.CompanyId,
    invoice.InvoiceNumber,
    invoice.SalesOrderId,
    salesOrder.OrderNumber,
    invoice.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    invoice.InvoiceDate,
    invoice.DueDate,
    invoice.CurrencyCode,
    invoice.ExchangeRate,
    invoice.Status,
    invoice.SubtotalAmount,
    invoice.DiscountAmount,
    invoice.TaxAmount,
    invoice.TotalAmount,
    invoice.AccountsReceivableDocumentId,
    arDocument.DocumentNumber AS AccountsReceivableDocumentNumber,
    invoice.Reference,
    invoice.Notes,
    invoice.PostedAt,
    invoice.PostedBy,
    COUNT(line.SalesInvoiceLineId) AS LineCount,
    CAST(COALESCE(SUM(line.Quantity), 0) AS DECIMAL(18,4)) AS TotalQuantity,
    invoice.IsActive,
    invoice.CreatedAt,
    invoice.UpdatedAt,
    invoice.CreatedBy,
    invoice.UpdatedBy
FROM sales.SalesInvoices invoice
INNER JOIN sales.SalesOrders salesOrder
    ON salesOrder.SalesOrderId = invoice.SalesOrderId
INNER JOIN crm.Customers customer
    ON customer.CustomerId = invoice.CustomerId
LEFT JOIN ar.AccountsReceivableDocuments arDocument
    ON arDocument.AccountsReceivableDocumentId = invoice.AccountsReceivableDocumentId
LEFT JOIN sales.SalesInvoiceLines line
    ON line.SalesInvoiceId = invoice.SalesInvoiceId
GROUP BY
    invoice.SalesInvoiceId,
    invoice.TenantId,
    invoice.CompanyId,
    invoice.InvoiceNumber,
    invoice.SalesOrderId,
    salesOrder.OrderNumber,
    invoice.CustomerId,
    customer.Code,
    customer.Name,
    invoice.InvoiceDate,
    invoice.DueDate,
    invoice.CurrencyCode,
    invoice.ExchangeRate,
    invoice.Status,
    invoice.SubtotalAmount,
    invoice.DiscountAmount,
    invoice.TaxAmount,
    invoice.TotalAmount,
    invoice.AccountsReceivableDocumentId,
    arDocument.DocumentNumber,
    invoice.Reference,
    invoice.Notes,
    invoice.PostedAt,
    invoice.PostedBy,
    invoice.IsActive,
    invoice.CreatedAt,
    invoice.UpdatedAt,
    invoice.CreatedBy,
    invoice.UpdatedBy;
GO

CREATE OR ALTER VIEW sales.V_SalesInvoiceLineSummary
AS
SELECT
    line.SalesInvoiceLineId,
    line.SalesInvoiceId,
    line.TenantId,
    line.CompanyId,
    invoice.InvoiceNumber,
    invoice.Status AS InvoiceStatus,
    invoice.SalesOrderId,
    salesOrder.OrderNumber,
    line.SalesShipmentId,
    shipment.ShipmentNumber,
    line.SalesShipmentLineId,
    line.SalesOrderLineId,
    line.LineNumber,
    line.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    line.UnitOfMeasureId,
    unit.Code AS UnitOfMeasureCode,
    line.Quantity,
    line.UnitPrice,
    line.DiscountPercent,
    line.DiscountAmount,
    line.TaxPercent,
    line.TaxAmount,
    line.LineSubtotal,
    line.LineTotal,
    line.Description,
    line.Notes,
    line.CreatedAt,
    line.UpdatedAt,
    line.CreatedBy,
    line.UpdatedBy,
    CAST(1 AS BIT) AS IsActive
FROM sales.SalesInvoiceLines line
INNER JOIN sales.SalesInvoices invoice
    ON invoice.SalesInvoiceId = line.SalesInvoiceId
INNER JOIN sales.SalesOrders salesOrder
    ON salesOrder.SalesOrderId = invoice.SalesOrderId
INNER JOIN sales.SalesShipments shipment
    ON shipment.SalesShipmentId = line.SalesShipmentId
INNER JOIN inventory.Items item
    ON item.ItemId = line.ItemId
INNER JOIN core.UnitsOfMeasure unit
    ON unit.UnitOfMeasureId = line.UnitOfMeasureId;
GO

CREATE OR ALTER VIEW sales.V_SalesShipmentInvoiceSummary
AS
WITH PostedInvoices AS (
    SELECT
        invoiceLine.TenantId,
        invoiceLine.CompanyId,
        invoiceLine.SalesShipmentLineId,
        SUM(invoiceLine.Quantity) AS PreviouslyInvoicedQuantity
    FROM sales.SalesInvoiceLines invoiceLine
    INNER JOIN sales.SalesInvoices invoice
        ON invoice.SalesInvoiceId = invoiceLine.SalesInvoiceId
    WHERE invoice.Status = 'POSTED'
    GROUP BY invoiceLine.TenantId, invoiceLine.CompanyId, invoiceLine.SalesShipmentLineId
)
SELECT
    shipmentLine.SalesShipmentLineId AS SalesShipmentInvoiceId,
    shipmentLine.TenantId,
    shipmentLine.CompanyId,
    shipment.SalesShipmentId,
    shipment.ShipmentNumber,
    shipment.Status AS ShipmentStatus,
    salesOrder.SalesOrderId,
    salesOrder.OrderNumber,
    salesOrder.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    salesOrder.CurrencyCode,
    salesOrder.ExchangeRate,
    shipmentLine.SalesOrderLineId,
    shipmentLine.SalesShipmentLineId,
    shipmentLine.LineNumber,
    shipmentLine.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    shipmentLine.UnitOfMeasureId,
    unit.Code AS UnitOfMeasureCode,
    CAST(shipmentLine.Quantity AS DECIMAL(18,4)) AS ShippedQuantity,
    CAST(COALESCE(posted.PreviouslyInvoicedQuantity, 0) AS DECIMAL(18,4)) AS PreviouslyInvoicedQuantity,
    CAST(shipmentLine.Quantity - COALESCE(posted.PreviouslyInvoicedQuantity, 0) AS DECIMAL(18,4)) AS PendingInvoiceQuantity,
    salesOrder.IsActive,
    shipmentLine.CreatedAt,
    shipmentLine.UpdatedAt,
    shipmentLine.CreatedBy,
    shipmentLine.UpdatedBy
FROM sales.SalesShipmentLines shipmentLine
INNER JOIN sales.SalesShipments shipment
    ON shipment.SalesShipmentId = shipmentLine.SalesShipmentId
INNER JOIN sales.SalesOrders salesOrder
    ON salesOrder.SalesOrderId = shipment.SalesOrderId
INNER JOIN crm.Customers customer
    ON customer.CustomerId = salesOrder.CustomerId
INNER JOIN inventory.Items item
    ON item.ItemId = shipmentLine.ItemId
INNER JOIN core.UnitsOfMeasure unit
    ON unit.UnitOfMeasureId = shipmentLine.UnitOfMeasureId
LEFT JOIN PostedInvoices posted
    ON posted.TenantId = shipmentLine.TenantId
   AND posted.CompanyId = shipmentLine.CompanyId
   AND posted.SalesShipmentLineId = shipmentLine.SalesShipmentLineId
WHERE shipment.Status = 'POSTED';
GO

CREATE OR ALTER VIEW sales.V_SalesOrderInvoiceSummary
AS
SELECT
    SalesOrderLineId AS SalesOrderInvoiceId,
    TenantId,
    CompanyId,
    SalesOrderId,
    OrderNumber,
    CustomerId,
    CustomerCode,
    CustomerName,
    CurrencyCode,
    ExchangeRate,
    SalesOrderLineId,
    MIN(LineNumber) AS LineNumber,
    ItemId,
    ItemCode,
    ItemDescription,
    UnitOfMeasureId,
    UnitOfMeasureCode,
    SUM(ShippedQuantity) AS ShippedQuantity,
    SUM(PreviouslyInvoicedQuantity) AS PreviouslyInvoicedQuantity,
    SUM(PendingInvoiceQuantity) AS PendingInvoiceQuantity,
    IsActive,
    MIN(CreatedAt) AS CreatedAt,
    MAX(UpdatedAt) AS UpdatedAt,
    CAST(NULL AS UNIQUEIDENTIFIER) AS CreatedBy,
    CAST(NULL AS UNIQUEIDENTIFIER) AS UpdatedBy
FROM sales.V_SalesShipmentInvoiceSummary
GROUP BY
    TenantId,
    CompanyId,
    SalesOrderId,
    OrderNumber,
    CustomerId,
    CustomerCode,
    CustomerName,
    CurrencyCode,
    ExchangeRate,
    SalesOrderLineId,
    ItemId,
    ItemCode,
    ItemDescription,
    UnitOfMeasureId,
    UnitOfMeasureCode,
    IsActive;
GO
