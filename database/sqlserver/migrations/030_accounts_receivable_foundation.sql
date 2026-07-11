IF SCHEMA_ID('ar') IS NULL
BEGIN
    EXEC('CREATE SCHEMA ar');
END;
GO

IF OBJECT_ID('ar.AccountsReceivableDocuments', 'U') IS NULL
BEGIN
    CREATE TABLE ar.AccountsReceivableDocuments (
        AccountsReceivableDocumentId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_ar_AccountsReceivableDocuments_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        DocumentNumber NVARCHAR(40) NOT NULL,
        SourceType NVARCHAR(40) NOT NULL,
        SourceDocumentId UNIQUEIDENTIFIER NULL,
        SourceDocumentNumber NVARCHAR(60) NULL,
        CustomerId UNIQUEIDENTIFIER NOT NULL,
        DocumentDate DATETIME2(7) NOT NULL,
        DueDate DATETIME2(7) NOT NULL,
        CurrencyCode NVARCHAR(3) NOT NULL,
        ExchangeRate DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_ar_AccountsReceivableDocuments_ExchangeRate DEFAULT (1),
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_ar_AccountsReceivableDocuments_Status DEFAULT 'OPEN',
        TotalAmount DECIMAL(18,4) NOT NULL,
        PaidAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_ar_AccountsReceivableDocuments_PaidAmount DEFAULT (0),
        RemainingAmount AS (TotalAmount - PaidAmount) PERSISTED,
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(1000) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_ar_AccountsReceivableDocuments_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_ar_AccountsReceivableDocuments_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_ar_AccountsReceivableDocuments PRIMARY KEY (AccountsReceivableDocumentId),
        CONSTRAINT FK_ar_AccountsReceivableDocuments_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_ar_AccountsReceivableDocuments_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_ar_AccountsReceivableDocuments_Customers FOREIGN KEY (CustomerId)
            REFERENCES crm.Customers (CustomerId),
        CONSTRAINT CK_ar_AccountsReceivableDocuments_Status CHECK (
            Status IN ('OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELLED')
        ),
        CONSTRAINT CK_ar_AccountsReceivableDocuments_SourceType CHECK (
            SourceType IN ('MANUAL', 'SALES_INVOICE', 'CUSTOMER_DEBIT_NOTE', 'OPENING_BALANCE')
        ),
        CONSTRAINT CK_ar_AccountsReceivableDocuments_TotalAmount CHECK (TotalAmount > 0),
        CONSTRAINT CK_ar_AccountsReceivableDocuments_PaidAmount CHECK (PaidAmount >= 0 AND PaidAmount <= TotalAmount),
        CONSTRAINT CK_ar_AccountsReceivableDocuments_ExchangeRate CHECK (ExchangeRate > 0),
        CONSTRAINT CK_ar_AccountsReceivableDocuments_Dates CHECK (DueDate >= DocumentDate)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ar.AccountsReceivableDocuments')
      AND name = 'UX_ar_AccountsReceivableDocuments_Tenant_Company_Number'
)
BEGIN
    CREATE UNIQUE INDEX UX_ar_AccountsReceivableDocuments_Tenant_Company_Number
        ON ar.AccountsReceivableDocuments (TenantId, CompanyId, DocumentNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ar.AccountsReceivableDocuments')
      AND name = 'IX_ar_AccountsReceivableDocuments_Customer_Status'
)
BEGIN
    CREATE INDEX IX_ar_AccountsReceivableDocuments_Customer_Status
        ON ar.AccountsReceivableDocuments (TenantId, CompanyId, CustomerId, Status);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ar.AccountsReceivableDocuments')
      AND name = 'IX_ar_AccountsReceivableDocuments_Dates'
)
BEGIN
    CREATE INDEX IX_ar_AccountsReceivableDocuments_Dates
        ON ar.AccountsReceivableDocuments (TenantId, CompanyId, DocumentDate, DueDate)
        INCLUDE (CustomerId, Status, TotalAmount, PaidAmount, IsActive);
END;
GO

CREATE OR ALTER VIEW ar.V_AccountsReceivableDocumentSummary
AS
SELECT
    document.AccountsReceivableDocumentId,
    document.TenantId,
    document.CompanyId,
    document.DocumentNumber,
    document.SourceType,
    document.SourceDocumentId,
    document.SourceDocumentNumber,
    document.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    document.DocumentDate,
    document.DueDate,
    document.CurrencyCode,
    document.ExchangeRate,
    document.Status,
    document.TotalAmount,
    document.PaidAmount,
    document.RemainingAmount,
    CASE
        WHEN CAST(document.DueDate AS date) >= CAST(SYSUTCDATETIME() AS date) THEN 0
        ELSE DATEDIFF(day, CAST(document.DueDate AS date), CAST(SYSUTCDATETIME() AS date))
    END AS DaysPastDue,
    document.Reference,
    document.Notes,
    document.IsActive,
    document.CreatedAt,
    document.UpdatedAt,
    document.CreatedBy,
    document.UpdatedBy
FROM ar.AccountsReceivableDocuments document
INNER JOIN crm.Customers customer
    ON customer.CustomerId = document.CustomerId;
GO

CREATE OR ALTER VIEW ar.V_CustomerReceivableBalanceSummary
AS
SELECT
    document.TenantId,
    document.CompanyId,
    document.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    SUM(document.TotalAmount) AS TotalDocumentAmount,
    SUM(document.PaidAmount) AS TotalPaidAmount,
    SUM(CASE WHEN document.Status IN ('OPEN', 'PARTIALLY_PAID') AND document.RemainingAmount > 0 THEN document.RemainingAmount ELSE 0 END) AS TotalOpenAmount,
    SUM(CASE WHEN document.Status IN ('OPEN', 'PARTIALLY_PAID') AND document.RemainingAmount > 0 AND CAST(document.DueDate AS date) < CAST(SYSUTCDATETIME() AS date) THEN document.RemainingAmount ELSE 0 END) AS OverdueAmount,
    SUM(CASE WHEN document.Status IN ('OPEN', 'PARTIALLY_PAID') AND document.RemainingAmount > 0 AND CAST(document.DueDate AS date) >= CAST(SYSUTCDATETIME() AS date) THEN document.RemainingAmount ELSE 0 END) AS NotDueAmount,
    SUM(CASE WHEN document.Status IN ('OPEN', 'PARTIALLY_PAID') AND document.RemainingAmount > 0 THEN 1 ELSE 0 END) AS OpenDocumentCount,
    SUM(CASE WHEN document.Status IN ('OPEN', 'PARTIALLY_PAID') AND document.RemainingAmount > 0 AND CAST(document.DueDate AS date) < CAST(SYSUTCDATETIME() AS date) THEN 1 ELSE 0 END) AS OverdueDocumentCount,
    MAX(document.DocumentDate) AS LastDocumentDate,
    MIN(customer.Code) AS Code,
    customer.Name AS Name,
    CAST(1 AS bit) AS IsActive,
    MIN(document.CreatedAt) AS CreatedAt,
    MAX(document.UpdatedAt) AS UpdatedAt,
    CAST(NULL AS uniqueidentifier) AS CreatedBy,
    CAST(NULL AS uniqueidentifier) AS UpdatedBy
FROM ar.AccountsReceivableDocuments document
INNER JOIN crm.Customers customer
    ON customer.CustomerId = document.CustomerId
WHERE document.IsActive = 1
GROUP BY document.TenantId, document.CompanyId, document.CustomerId, customer.Code, customer.Name;
GO
