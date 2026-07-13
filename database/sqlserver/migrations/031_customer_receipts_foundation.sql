IF SCHEMA_ID('ar') IS NULL
BEGIN
    EXEC('CREATE SCHEMA ar');
END;
GO

IF OBJECT_ID('ar.CustomerReceipts', 'U') IS NULL
BEGIN
    CREATE TABLE ar.CustomerReceipts (
        CustomerReceiptId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_ar_CustomerReceipts_CustomerReceiptId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        ReceiptNumber NVARCHAR(40) NOT NULL,
        CustomerId UNIQUEIDENTIFIER NOT NULL,
        ReceiptDate DATETIME2(0) NOT NULL
            CONSTRAINT DF_ar_CustomerReceipts_ReceiptDate DEFAULT SYSUTCDATETIME(),
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_ar_CustomerReceipts_Status DEFAULT 'DRAFT',
        ReceiptMethod NVARCHAR(40) NOT NULL
            CONSTRAINT DF_ar_CustomerReceipts_ReceiptMethod DEFAULT 'MANUAL',
        TotalAmount DECIMAL(18, 4) NOT NULL,
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(1000) NULL,
        PostedAt DATETIME2(0) NULL,
        PostedBy UNIQUEIDENTIFIER NULL,
        CancelledAt DATETIME2(0) NULL,
        CancelledBy UNIQUEIDENTIFIER NULL,
        CancellationReason NVARCHAR(500) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_ar_CustomerReceipts_IsActive DEFAULT (1),
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_ar_CustomerReceipts_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(0) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_ar_CustomerReceipts PRIMARY KEY (CustomerReceiptId),
        CONSTRAINT FK_ar_CustomerReceipts_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_ar_CustomerReceipts_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_ar_CustomerReceipts_Customers FOREIGN KEY (CustomerId)
            REFERENCES crm.Customers (CustomerId),
        CONSTRAINT CK_ar_CustomerReceipts_Status CHECK (
            Status IN ('DRAFT', 'POSTED', 'CANCELLED')
        ),
        CONSTRAINT CK_ar_CustomerReceipts_TotalAmount CHECK (TotalAmount > 0)
    );
END;
GO

IF OBJECT_ID('ar.CustomerReceiptApplications', 'U') IS NULL
BEGIN
    CREATE TABLE ar.CustomerReceiptApplications (
        CustomerReceiptApplicationId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_ar_CustomerReceiptApplications_CustomerReceiptApplicationId DEFAULT NEWSEQUENTIALID(),
        CustomerReceiptId UNIQUEIDENTIFIER NOT NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        LineNumber INT NOT NULL,
        AccountsReceivableDocumentId UNIQUEIDENTIFIER NOT NULL,
        AppliedAmount DECIMAL(18, 4) NOT NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_ar_CustomerReceiptApplications_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(0) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_ar_CustomerReceiptApplications PRIMARY KEY (CustomerReceiptApplicationId),
        CONSTRAINT FK_ar_CustomerReceiptApplications_Receipts FOREIGN KEY (CustomerReceiptId)
            REFERENCES ar.CustomerReceipts (CustomerReceiptId),
        CONSTRAINT FK_ar_CustomerReceiptApplications_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_ar_CustomerReceiptApplications_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_ar_CustomerReceiptApplications_Documents FOREIGN KEY (AccountsReceivableDocumentId)
            REFERENCES ar.AccountsReceivableDocuments (AccountsReceivableDocumentId),
        CONSTRAINT CK_ar_CustomerReceiptApplications_AppliedAmount CHECK (AppliedAmount > 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ar.CustomerReceipts')
      AND name = 'UX_ar_CustomerReceipts_Tenant_Company_Number'
)
BEGIN
    CREATE UNIQUE INDEX UX_ar_CustomerReceipts_Tenant_Company_Number
        ON ar.CustomerReceipts (TenantId, CompanyId, ReceiptNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ar.CustomerReceipts')
      AND name = 'IX_ar_CustomerReceipts_Tenant_Company_Customer_Status'
)
BEGIN
    CREATE INDEX IX_ar_CustomerReceipts_Tenant_Company_Customer_Status
        ON ar.CustomerReceipts (TenantId, CompanyId, CustomerId, Status);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ar.CustomerReceiptApplications')
      AND name = 'UX_ar_CustomerReceiptApplications_Receipt_Document'
)
BEGIN
    CREATE UNIQUE INDEX UX_ar_CustomerReceiptApplications_Receipt_Document
        ON ar.CustomerReceiptApplications (CustomerReceiptId, AccountsReceivableDocumentId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ar.CustomerReceiptApplications')
      AND name = 'UX_ar_CustomerReceiptApplications_Receipt_Line'
)
BEGIN
    CREATE UNIQUE INDEX UX_ar_CustomerReceiptApplications_Receipt_Line
        ON ar.CustomerReceiptApplications (CustomerReceiptId, LineNumber);
END;
GO

CREATE OR ALTER VIEW ar.V_CustomerReceiptSummary
AS
SELECT
    receipt.CustomerReceiptId,
    receipt.TenantId,
    receipt.CompanyId,
    receipt.ReceiptNumber,
    receipt.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    receipt.ReceiptDate,
    receipt.Status,
    receipt.ReceiptMethod,
    receipt.TotalAmount,
    COALESCE(applications.AppliedAmount, 0) AS AppliedAmount,
    receipt.TotalAmount - COALESCE(applications.AppliedAmount, 0) AS UnappliedAmount,
    COALESCE(applications.ApplicationCount, 0) AS ApplicationCount,
    receipt.Reference,
    receipt.Notes,
    receipt.PostedAt,
    receipt.CancelledAt,
    receipt.IsActive,
    receipt.CreatedAt,
    receipt.UpdatedAt,
    receipt.CreatedBy,
    receipt.UpdatedBy
FROM ar.CustomerReceipts receipt
INNER JOIN crm.Customers customer
    ON customer.CustomerId = receipt.CustomerId
LEFT JOIN (
    SELECT
        CustomerReceiptId,
        SUM(AppliedAmount) AS AppliedAmount,
        COUNT(1) AS ApplicationCount
    FROM ar.CustomerReceiptApplications
    GROUP BY CustomerReceiptId
) applications
    ON applications.CustomerReceiptId = receipt.CustomerReceiptId;
GO

CREATE OR ALTER VIEW ar.V_CustomerReceiptApplicationSummary
AS
SELECT
    application.CustomerReceiptApplicationId,
    application.CustomerReceiptId,
    receipt.ReceiptNumber,
    application.TenantId,
    application.CompanyId,
    application.LineNumber,
    application.AccountsReceivableDocumentId,
    document.DocumentNumber,
    document.SourceDocumentNumber,
    receipt.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    document.DocumentDate,
    document.DueDate,
    document.Status AS DocumentStatus,
    document.TotalAmount AS DocumentTotalAmount,
    document.PaidAmount AS DocumentPaidAmount,
    document.RemainingAmount AS DocumentRemainingAmount,
    application.AppliedAmount,
    application.Notes,
    CAST(1 AS bit) AS IsActive,
    application.CreatedAt,
    application.UpdatedAt,
    application.CreatedBy,
    application.UpdatedBy
FROM ar.CustomerReceiptApplications application
INNER JOIN ar.CustomerReceipts receipt
    ON receipt.CustomerReceiptId = application.CustomerReceiptId
INNER JOIN ar.AccountsReceivableDocuments document
    ON document.AccountsReceivableDocumentId = application.AccountsReceivableDocumentId
INNER JOIN crm.Customers customer
    ON customer.CustomerId = receipt.CustomerId;
GO
