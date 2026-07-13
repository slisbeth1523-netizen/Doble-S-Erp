IF SCHEMA_ID('sales') IS NULL
BEGIN
    EXEC('CREATE SCHEMA sales');
END;
GO

IF OBJECT_ID('sales.SalesQuotations', 'U') IS NULL
BEGIN
    CREATE TABLE sales.SalesQuotations (
        SalesQuotationId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_sales_SalesQuotations_SalesQuotationId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        QuotationNumber NVARCHAR(40) NOT NULL,
        CustomerId UNIQUEIDENTIFIER NOT NULL,
        QuotationDate DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesQuotations_QuotationDate DEFAULT SYSUTCDATETIME(),
        ValidUntil DATETIME2(7) NOT NULL,
        CurrencyCode NVARCHAR(3) NOT NULL,
        ExchangeRate DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_sales_SalesQuotations_ExchangeRate DEFAULT (1),
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_sales_SalesQuotations_Status DEFAULT 'DRAFT',
        SubtotalAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesQuotations_SubtotalAmount DEFAULT (0),
        DiscountAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesQuotations_DiscountAmount DEFAULT (0),
        TaxAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesQuotations_TaxAmount DEFAULT (0),
        TotalAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesQuotations_TotalAmount DEFAULT (0),
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(1000) NULL,
        SentAt DATETIME2(7) NULL,
        SentBy UNIQUEIDENTIFIER NULL,
        ApprovedAt DATETIME2(7) NULL,
        ApprovedBy UNIQUEIDENTIFIER NULL,
        RejectedAt DATETIME2(7) NULL,
        RejectedBy UNIQUEIDENTIFIER NULL,
        ExpiredAt DATETIME2(7) NULL,
        ExpiredBy UNIQUEIDENTIFIER NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_sales_SalesQuotations_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesQuotations_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_sales_SalesQuotations PRIMARY KEY (SalesQuotationId),
        CONSTRAINT FK_sales_SalesQuotations_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_sales_SalesQuotations_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_sales_SalesQuotations_Customers FOREIGN KEY (CustomerId)
            REFERENCES crm.Customers (CustomerId),
        CONSTRAINT CK_sales_SalesQuotations_Status CHECK (
            Status IN ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED')
        ),
        CONSTRAINT CK_sales_SalesQuotations_ExchangeRate CHECK (ExchangeRate > 0),
        CONSTRAINT CK_sales_SalesQuotations_Dates CHECK (ValidUntil >= QuotationDate),
        CONSTRAINT CK_sales_SalesQuotations_Amounts CHECK (
            SubtotalAmount >= 0 AND DiscountAmount >= 0 AND TaxAmount >= 0 AND TotalAmount >= 0
        )
    );
END;
GO

IF OBJECT_ID('sales.SalesQuotationLines', 'U') IS NULL
BEGIN
    CREATE TABLE sales.SalesQuotationLines (
        SalesQuotationLineId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_sales_SalesQuotationLines_SalesQuotationLineId DEFAULT NEWSEQUENTIALID(),
        SalesQuotationId UNIQUEIDENTIFIER NOT NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        LineNumber INT NOT NULL,
        ItemId UNIQUEIDENTIFIER NOT NULL,
        UnitOfMeasureId UNIQUEIDENTIFIER NOT NULL,
        Description NVARCHAR(300) NOT NULL,
        Quantity DECIMAL(18,4) NOT NULL,
        UnitPrice DECIMAL(18,4) NOT NULL,
        DiscountPercent DECIMAL(9,4) NOT NULL
            CONSTRAINT DF_sales_SalesQuotationLines_DiscountPercent DEFAULT (0),
        DiscountAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesQuotationLines_DiscountAmount DEFAULT (0),
        TaxPercent DECIMAL(9,4) NOT NULL
            CONSTRAINT DF_sales_SalesQuotationLines_TaxPercent DEFAULT (0),
        TaxAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesQuotationLines_TaxAmount DEFAULT (0),
        LineSubtotal DECIMAL(18,4) NOT NULL,
        LineTotal DECIMAL(18,4) NOT NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesQuotationLines_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_sales_SalesQuotationLines PRIMARY KEY (SalesQuotationLineId),
        CONSTRAINT FK_sales_SalesQuotationLines_SalesQuotations FOREIGN KEY (SalesQuotationId)
            REFERENCES sales.SalesQuotations (SalesQuotationId),
        CONSTRAINT FK_sales_SalesQuotationLines_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_sales_SalesQuotationLines_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_sales_SalesQuotationLines_Items FOREIGN KEY (ItemId)
            REFERENCES inventory.Items (ItemId),
        CONSTRAINT FK_sales_SalesQuotationLines_UnitsOfMeasure FOREIGN KEY (UnitOfMeasureId)
            REFERENCES core.UnitsOfMeasure (UnitOfMeasureId),
        CONSTRAINT CK_sales_SalesQuotationLines_Quantity CHECK (Quantity > 0),
        CONSTRAINT CK_sales_SalesQuotationLines_UnitPrice CHECK (UnitPrice >= 0),
        CONSTRAINT CK_sales_SalesQuotationLines_DiscountPercent CHECK (DiscountPercent >= 0 AND DiscountPercent <= 100),
        CONSTRAINT CK_sales_SalesQuotationLines_TaxPercent CHECK (TaxPercent >= 0 AND TaxPercent <= 100),
        CONSTRAINT CK_sales_SalesQuotationLines_Amounts CHECK (
            DiscountAmount >= 0 AND TaxAmount >= 0 AND LineSubtotal >= 0 AND LineTotal >= 0
        )
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('sales.SalesQuotations')
      AND name = 'UX_sales_SalesQuotations_Tenant_Company_Number'
)
BEGIN
    CREATE UNIQUE INDEX UX_sales_SalesQuotations_Tenant_Company_Number
        ON sales.SalesQuotations (TenantId, CompanyId, QuotationNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('sales.SalesQuotations')
      AND name = 'IX_sales_SalesQuotations_Tenant_Company_Customer'
)
BEGIN
    CREATE INDEX IX_sales_SalesQuotations_Tenant_Company_Customer
        ON sales.SalesQuotations (TenantId, CompanyId, CustomerId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('sales.SalesQuotations')
      AND name = 'IX_sales_SalesQuotations_Tenant_Company_Status'
)
BEGIN
    CREATE INDEX IX_sales_SalesQuotations_Tenant_Company_Status
        ON sales.SalesQuotations (TenantId, CompanyId, Status);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('sales.SalesQuotations')
      AND name = 'IX_sales_SalesQuotations_Tenant_Company_Dates'
)
BEGIN
    CREATE INDEX IX_sales_SalesQuotations_Tenant_Company_Dates
        ON sales.SalesQuotations (TenantId, CompanyId, QuotationDate, ValidUntil);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('sales.SalesQuotationLines')
      AND name = 'UX_sales_SalesQuotationLines_Quotation_Line'
)
BEGIN
    CREATE UNIQUE INDEX UX_sales_SalesQuotationLines_Quotation_Line
        ON sales.SalesQuotationLines (SalesQuotationId, LineNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('sales.SalesQuotationLines')
      AND name = 'IX_sales_SalesQuotationLines_Tenant_Company_Item'
)
BEGIN
    CREATE INDEX IX_sales_SalesQuotationLines_Tenant_Company_Item
        ON sales.SalesQuotationLines (TenantId, CompanyId, ItemId);
END;
GO

CREATE OR ALTER VIEW sales.V_SalesQuotationSummary
AS
SELECT
    quotation.SalesQuotationId,
    quotation.TenantId,
    quotation.CompanyId,
    quotation.QuotationNumber,
    quotation.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    quotation.QuotationDate,
    quotation.ValidUntil,
    quotation.CurrencyCode,
    quotation.ExchangeRate,
    quotation.Status,
    quotation.SubtotalAmount,
    quotation.DiscountAmount,
    quotation.TaxAmount,
    quotation.TotalAmount,
    COUNT(line.SalesQuotationLineId) AS LineCount,
    quotation.Reference,
    quotation.Notes,
    quotation.SentAt,
    quotation.ApprovedAt,
    quotation.RejectedAt,
    quotation.ExpiredAt,
    quotation.IsActive,
    quotation.CreatedAt,
    quotation.UpdatedAt,
    quotation.CreatedBy,
    quotation.UpdatedBy
FROM sales.SalesQuotations quotation
INNER JOIN crm.Customers customer
    ON customer.CustomerId = quotation.CustomerId
LEFT JOIN sales.SalesQuotationLines line
    ON line.SalesQuotationId = quotation.SalesQuotationId
GROUP BY
    quotation.SalesQuotationId,
    quotation.TenantId,
    quotation.CompanyId,
    quotation.QuotationNumber,
    quotation.CustomerId,
    customer.Code,
    customer.Name,
    quotation.QuotationDate,
    quotation.ValidUntil,
    quotation.CurrencyCode,
    quotation.ExchangeRate,
    quotation.Status,
    quotation.SubtotalAmount,
    quotation.DiscountAmount,
    quotation.TaxAmount,
    quotation.TotalAmount,
    quotation.Reference,
    quotation.Notes,
    quotation.SentAt,
    quotation.ApprovedAt,
    quotation.RejectedAt,
    quotation.ExpiredAt,
    quotation.IsActive,
    quotation.CreatedAt,
    quotation.UpdatedAt,
    quotation.CreatedBy,
    quotation.UpdatedBy;
GO

CREATE OR ALTER VIEW sales.V_SalesQuotationLineSummary
AS
SELECT
    line.SalesQuotationLineId,
    line.SalesQuotationId,
    line.TenantId,
    line.CompanyId,
    quotation.QuotationNumber,
    quotation.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    quotation.Status,
    quotation.QuotationDate,
    quotation.ValidUntil,
    line.LineNumber,
    line.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    line.UnitOfMeasureId,
    unit.Code AS UnitOfMeasureCode,
    unit.Name AS UnitOfMeasureName,
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
    quotation.IsActive,
    line.CreatedAt,
    line.UpdatedAt,
    line.CreatedBy,
    line.UpdatedBy
FROM sales.SalesQuotationLines line
INNER JOIN sales.SalesQuotations quotation
    ON quotation.SalesQuotationId = line.SalesQuotationId
INNER JOIN crm.Customers customer
    ON customer.CustomerId = quotation.CustomerId
INNER JOIN inventory.Items item
    ON item.ItemId = line.ItemId
INNER JOIN core.UnitsOfMeasure unit
    ON unit.UnitOfMeasureId = line.UnitOfMeasureId;
GO
