IF SCHEMA_ID('ar') IS NULL
BEGIN
    EXEC('CREATE SCHEMA ar');
END;
GO

IF OBJECT_ID('ar.CustomerCreditNotes', 'U') IS NULL
BEGIN
    CREATE TABLE ar.CustomerCreditNotes (
        CustomerCreditNoteId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_ar_CustomerCreditNotes_CustomerCreditNoteId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        CreditNoteNumber NVARCHAR(40) NOT NULL,
        CustomerId UNIQUEIDENTIFIER NOT NULL,
        CreditNoteDate DATETIME2(0) NOT NULL
            CONSTRAINT DF_ar_CustomerCreditNotes_CreditNoteDate DEFAULT SYSUTCDATETIME(),
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_ar_CustomerCreditNotes_Status DEFAULT 'DRAFT',
        Amount DECIMAL(18, 4) NOT NULL,
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(1000) NULL,
        PostedAt DATETIME2(0) NULL,
        PostedBy UNIQUEIDENTIFIER NULL,
        CancelledAt DATETIME2(0) NULL,
        CancelledBy UNIQUEIDENTIFIER NULL,
        CancellationReason NVARCHAR(500) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_ar_CustomerCreditNotes_IsActive DEFAULT (1),
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_ar_CustomerCreditNotes_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(0) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_ar_CustomerCreditNotes PRIMARY KEY (CustomerCreditNoteId),
        CONSTRAINT FK_ar_CustomerCreditNotes_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_ar_CustomerCreditNotes_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_ar_CustomerCreditNotes_Customers FOREIGN KEY (CustomerId)
            REFERENCES crm.Customers (CustomerId),
        CONSTRAINT CK_ar_CustomerCreditNotes_Status CHECK (
            Status IN ('DRAFT', 'POSTED', 'CANCELLED')
        ),
        CONSTRAINT CK_ar_CustomerCreditNotes_Amount CHECK (Amount > 0)
    );
END;
GO

IF OBJECT_ID('ar.CustomerCreditNoteApplications', 'U') IS NULL
BEGIN
    CREATE TABLE ar.CustomerCreditNoteApplications (
        CustomerCreditNoteApplicationId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_ar_CustomerCreditNoteApplications_CustomerCreditNoteApplicationId DEFAULT NEWSEQUENTIALID(),
        CustomerCreditNoteId UNIQUEIDENTIFIER NOT NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        LineNumber INT NOT NULL,
        AccountsReceivableDocumentId UNIQUEIDENTIFIER NOT NULL,
        AppliedAmount DECIMAL(18, 4) NOT NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_ar_CustomerCreditNoteApplications_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(0) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_ar_CustomerCreditNoteApplications PRIMARY KEY (CustomerCreditNoteApplicationId),
        CONSTRAINT FK_ar_CustomerCreditNoteApplications_CreditNotes FOREIGN KEY (CustomerCreditNoteId)
            REFERENCES ar.CustomerCreditNotes (CustomerCreditNoteId),
        CONSTRAINT FK_ar_CustomerCreditNoteApplications_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_ar_CustomerCreditNoteApplications_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_ar_CustomerCreditNoteApplications_Documents FOREIGN KEY (AccountsReceivableDocumentId)
            REFERENCES ar.AccountsReceivableDocuments (AccountsReceivableDocumentId),
        CONSTRAINT CK_ar_CustomerCreditNoteApplications_AppliedAmount CHECK (AppliedAmount > 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ar.CustomerCreditNotes')
      AND name = 'UX_ar_CustomerCreditNotes_Tenant_Company_Number'
)
BEGIN
    CREATE UNIQUE INDEX UX_ar_CustomerCreditNotes_Tenant_Company_Number
        ON ar.CustomerCreditNotes (TenantId, CompanyId, CreditNoteNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ar.CustomerCreditNotes')
      AND name = 'IX_ar_CustomerCreditNotes_Tenant_Company_Customer_Status'
)
BEGIN
    CREATE INDEX IX_ar_CustomerCreditNotes_Tenant_Company_Customer_Status
        ON ar.CustomerCreditNotes (TenantId, CompanyId, CustomerId, Status);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ar.CustomerCreditNoteApplications')
      AND name = 'UX_ar_CustomerCreditNoteApplications_Note_Document'
)
BEGIN
    CREATE UNIQUE INDEX UX_ar_CustomerCreditNoteApplications_Note_Document
        ON ar.CustomerCreditNoteApplications (CustomerCreditNoteId, AccountsReceivableDocumentId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ar.CustomerCreditNoteApplications')
      AND name = 'UX_ar_CustomerCreditNoteApplications_Note_Line'
)
BEGIN
    CREATE UNIQUE INDEX UX_ar_CustomerCreditNoteApplications_Note_Line
        ON ar.CustomerCreditNoteApplications (CustomerCreditNoteId, LineNumber);
END;
GO

CREATE OR ALTER VIEW ar.V_CustomerCreditNoteSummary
AS
SELECT
    note.CustomerCreditNoteId,
    note.TenantId,
    note.CompanyId,
    note.CreditNoteNumber,
    note.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    note.CreditNoteDate,
    note.Status,
    note.Amount,
    COALESCE(applications.AppliedAmount, 0) AS AppliedAmount,
    note.Amount - COALESCE(applications.AppliedAmount, 0) AS UnappliedAmount,
    COALESCE(applications.ApplicationCount, 0) AS ApplicationCount,
    note.Reference,
    note.Notes,
    note.PostedAt,
    note.CancelledAt,
    note.IsActive,
    note.CreatedAt,
    note.UpdatedAt,
    note.CreatedBy,
    note.UpdatedBy
FROM ar.CustomerCreditNotes note
INNER JOIN crm.Customers customer
    ON customer.CustomerId = note.CustomerId
LEFT JOIN (
    SELECT
        CustomerCreditNoteId,
        SUM(AppliedAmount) AS AppliedAmount,
        COUNT(1) AS ApplicationCount
    FROM ar.CustomerCreditNoteApplications
    GROUP BY CustomerCreditNoteId
) applications
    ON applications.CustomerCreditNoteId = note.CustomerCreditNoteId;
GO

CREATE OR ALTER VIEW ar.V_CustomerCreditNoteApplicationSummary
AS
SELECT
    application.CustomerCreditNoteApplicationId,
    application.CustomerCreditNoteId,
    note.CreditNoteNumber,
    application.TenantId,
    application.CompanyId,
    application.LineNumber,
    application.AccountsReceivableDocumentId,
    document.DocumentNumber,
    document.SourceDocumentNumber,
    note.CustomerId,
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
FROM ar.CustomerCreditNoteApplications application
INNER JOIN ar.CustomerCreditNotes note
    ON note.CustomerCreditNoteId = application.CustomerCreditNoteId
INNER JOIN ar.AccountsReceivableDocuments document
    ON document.AccountsReceivableDocumentId = application.AccountsReceivableDocumentId
INNER JOIN crm.Customers customer
    ON customer.CustomerId = note.CustomerId;
GO
