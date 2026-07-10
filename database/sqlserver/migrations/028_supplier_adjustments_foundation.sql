IF SCHEMA_ID('ap') IS NULL
BEGIN
    EXEC('CREATE SCHEMA ap');
END;
GO

IF OBJECT_ID('ap.SupplierAdjustments', 'U') IS NULL
BEGIN
    CREATE TABLE ap.SupplierAdjustments (
        SupplierAdjustmentId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_ap_SupplierAdjustments_SupplierAdjustmentId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        AdjustmentNumber NVARCHAR(40) NOT NULL,
        SupplierId UNIQUEIDENTIFIER NOT NULL,
        AdjustmentType NVARCHAR(30) NOT NULL,
        AdjustmentDate DATETIME2(0) NOT NULL
            CONSTRAINT DF_ap_SupplierAdjustments_AdjustmentDate DEFAULT SYSUTCDATETIME(),
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_ap_SupplierAdjustments_Status DEFAULT 'DRAFT',
        Amount DECIMAL(18, 4) NOT NULL,
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(1000) NULL,
        GeneratedAccountsPayableDocumentId UNIQUEIDENTIFIER NULL,
        PostedAt DATETIME2(0) NULL,
        PostedBy UNIQUEIDENTIFIER NULL,
        CancelledAt DATETIME2(0) NULL,
        CancelledBy UNIQUEIDENTIFIER NULL,
        CancellationReason NVARCHAR(500) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_ap_SupplierAdjustments_IsActive DEFAULT (1),
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_ap_SupplierAdjustments_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(0) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_ap_SupplierAdjustments PRIMARY KEY (SupplierAdjustmentId),
        CONSTRAINT FK_ap_SupplierAdjustments_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_ap_SupplierAdjustments_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_ap_SupplierAdjustments_Suppliers FOREIGN KEY (SupplierId)
            REFERENCES purchasing.Suppliers (SupplierId),
        CONSTRAINT FK_ap_SupplierAdjustments_GeneratedDocument FOREIGN KEY (GeneratedAccountsPayableDocumentId)
            REFERENCES ap.AccountsPayableDocuments (AccountsPayableDocumentId),
        CONSTRAINT CK_ap_SupplierAdjustments_Type CHECK (
            AdjustmentType IN ('CREDIT_NOTE', 'DEBIT_NOTE')
        ),
        CONSTRAINT CK_ap_SupplierAdjustments_Status CHECK (
            Status IN ('DRAFT', 'POSTED', 'CANCELLED')
        ),
        CONSTRAINT CK_ap_SupplierAdjustments_Amount CHECK (Amount > 0)
    );
END;
GO

IF OBJECT_ID('ap.SupplierAdjustmentApplications', 'U') IS NULL
BEGIN
    CREATE TABLE ap.SupplierAdjustmentApplications (
        SupplierAdjustmentApplicationId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_ap_SupplierAdjustmentApplications_SupplierAdjustmentApplicationId DEFAULT NEWSEQUENTIALID(),
        SupplierAdjustmentId UNIQUEIDENTIFIER NOT NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        LineNumber INT NOT NULL,
        AccountsPayableDocumentId UNIQUEIDENTIFIER NOT NULL,
        AppliedAmount DECIMAL(18, 4) NOT NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_ap_SupplierAdjustmentApplications_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(0) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_ap_SupplierAdjustmentApplications PRIMARY KEY (SupplierAdjustmentApplicationId),
        CONSTRAINT FK_ap_SupplierAdjustmentApplications_Adjustments FOREIGN KEY (SupplierAdjustmentId)
            REFERENCES ap.SupplierAdjustments (SupplierAdjustmentId),
        CONSTRAINT FK_ap_SupplierAdjustmentApplications_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_ap_SupplierAdjustmentApplications_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_ap_SupplierAdjustmentApplications_Documents FOREIGN KEY (AccountsPayableDocumentId)
            REFERENCES ap.AccountsPayableDocuments (AccountsPayableDocumentId),
        CONSTRAINT CK_ap_SupplierAdjustmentApplications_AppliedAmount CHECK (AppliedAmount > 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ap.SupplierAdjustments')
      AND name = 'UX_ap_SupplierAdjustments_Tenant_Company_Number'
)
BEGIN
    CREATE UNIQUE INDEX UX_ap_SupplierAdjustments_Tenant_Company_Number
        ON ap.SupplierAdjustments (TenantId, CompanyId, AdjustmentNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ap.SupplierAdjustments')
      AND name = 'IX_ap_SupplierAdjustments_Tenant_Company_Supplier_Status'
)
BEGIN
    CREATE INDEX IX_ap_SupplierAdjustments_Tenant_Company_Supplier_Status
        ON ap.SupplierAdjustments (TenantId, CompanyId, SupplierId, Status, AdjustmentType);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ap.SupplierAdjustmentApplications')
      AND name = 'UX_ap_SupplierAdjustmentApplications_Adjustment_Document'
)
BEGIN
    CREATE UNIQUE INDEX UX_ap_SupplierAdjustmentApplications_Adjustment_Document
        ON ap.SupplierAdjustmentApplications (SupplierAdjustmentId, AccountsPayableDocumentId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ap.SupplierAdjustmentApplications')
      AND name = 'UX_ap_SupplierAdjustmentApplications_Adjustment_Line'
)
BEGIN
    CREATE UNIQUE INDEX UX_ap_SupplierAdjustmentApplications_Adjustment_Line
        ON ap.SupplierAdjustmentApplications (SupplierAdjustmentId, LineNumber);
END;
GO

CREATE OR ALTER VIEW ap.V_SupplierAdjustmentSummary
AS
SELECT
    adjustment.SupplierAdjustmentId,
    adjustment.TenantId,
    adjustment.CompanyId,
    adjustment.AdjustmentNumber,
    adjustment.SupplierId,
    supplier.Code AS SupplierCode,
    supplier.Name AS SupplierName,
    adjustment.AdjustmentType,
    adjustment.AdjustmentDate,
    adjustment.Status,
    adjustment.Amount,
    COALESCE(applications.AppliedAmount, 0) AS AppliedAmount,
    adjustment.Amount - COALESCE(applications.AppliedAmount, 0) AS UnappliedAmount,
    COALESCE(applications.ApplicationCount, 0) AS ApplicationCount,
    adjustment.GeneratedAccountsPayableDocumentId,
    generated.DocumentNumber AS GeneratedDocumentNumber,
    adjustment.Reference,
    adjustment.Notes,
    adjustment.PostedAt,
    adjustment.CancelledAt,
    adjustment.IsActive,
    adjustment.CreatedAt,
    adjustment.UpdatedAt,
    adjustment.CreatedBy,
    adjustment.UpdatedBy
FROM ap.SupplierAdjustments adjustment
INNER JOIN purchasing.Suppliers supplier
    ON supplier.SupplierId = adjustment.SupplierId
LEFT JOIN ap.AccountsPayableDocuments generated
    ON generated.AccountsPayableDocumentId = adjustment.GeneratedAccountsPayableDocumentId
LEFT JOIN (
    SELECT
        SupplierAdjustmentId,
        SUM(AppliedAmount) AS AppliedAmount,
        COUNT(1) AS ApplicationCount
    FROM ap.SupplierAdjustmentApplications
    GROUP BY SupplierAdjustmentId
) applications
    ON applications.SupplierAdjustmentId = adjustment.SupplierAdjustmentId;
GO

CREATE OR ALTER VIEW ap.V_SupplierAdjustmentApplicationSummary
AS
SELECT
    application.SupplierAdjustmentApplicationId,
    application.SupplierAdjustmentId,
    adjustment.AdjustmentNumber,
    adjustment.AdjustmentType,
    application.TenantId,
    application.CompanyId,
    application.LineNumber,
    application.AccountsPayableDocumentId,
    document.DocumentNumber,
    document.SourceDocumentNumber,
    adjustment.SupplierId,
    supplier.Code AS SupplierCode,
    supplier.Name AS SupplierName,
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
FROM ap.SupplierAdjustmentApplications application
INNER JOIN ap.SupplierAdjustments adjustment
    ON adjustment.SupplierAdjustmentId = application.SupplierAdjustmentId
INNER JOIN ap.AccountsPayableDocuments document
    ON document.AccountsPayableDocumentId = application.AccountsPayableDocumentId
INNER JOIN purchasing.Suppliers supplier
    ON supplier.SupplierId = adjustment.SupplierId;
GO
