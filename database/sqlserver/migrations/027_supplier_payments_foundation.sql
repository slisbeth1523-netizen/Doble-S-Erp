IF SCHEMA_ID('ap') IS NULL
BEGIN
    EXEC('CREATE SCHEMA ap');
END;
GO

IF OBJECT_ID('ap.AccountsPayableDocuments', 'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('ap.AccountsPayableDocuments')
          AND name = 'CK_ap_AccountsPayableDocuments_Status'
    )
    BEGIN
        ALTER TABLE ap.AccountsPayableDocuments
            DROP CONSTRAINT CK_ap_AccountsPayableDocuments_Status;
    END;

    UPDATE ap.AccountsPayableDocuments
    SET Status = 'OPEN',
        UpdatedAt = SYSUTCDATETIME()
    WHERE Status = 'PENDING';

    IF EXISTS (
        SELECT 1
        FROM sys.default_constraints
        WHERE parent_object_id = OBJECT_ID('ap.AccountsPayableDocuments')
          AND name = 'DF_ap_AccountsPayableDocuments_Status'
    )
    BEGIN
        ALTER TABLE ap.AccountsPayableDocuments
            DROP CONSTRAINT DF_ap_AccountsPayableDocuments_Status;
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.default_constraints
        WHERE parent_object_id = OBJECT_ID('ap.AccountsPayableDocuments')
          AND name = 'DF_ap_AccountsPayableDocuments_Status'
    )
    BEGIN
        ALTER TABLE ap.AccountsPayableDocuments
            ADD CONSTRAINT DF_ap_AccountsPayableDocuments_Status DEFAULT 'OPEN' FOR Status;
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('ap.AccountsPayableDocuments')
          AND name = 'CK_ap_AccountsPayableDocuments_Status'
    )
    BEGIN
        ALTER TABLE ap.AccountsPayableDocuments
            ADD CONSTRAINT CK_ap_AccountsPayableDocuments_Status CHECK (
                Status IN ('OPEN', 'PARTIALLY_PAID', 'PAID')
            );
    END;
END;
GO

IF OBJECT_ID('ap.SupplierPayments', 'U') IS NULL
BEGIN
    CREATE TABLE ap.SupplierPayments (
        SupplierPaymentId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_ap_SupplierPayments_SupplierPaymentId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        PaymentNumber NVARCHAR(40) NOT NULL,
        SupplierId UNIQUEIDENTIFIER NOT NULL,
        PaymentDate DATETIME2(0) NOT NULL
            CONSTRAINT DF_ap_SupplierPayments_PaymentDate DEFAULT SYSUTCDATETIME(),
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_ap_SupplierPayments_Status DEFAULT 'DRAFT',
        PaymentMethod NVARCHAR(40) NOT NULL
            CONSTRAINT DF_ap_SupplierPayments_PaymentMethod DEFAULT 'MANUAL',
        TotalAmount DECIMAL(18, 4) NOT NULL,
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(1000) NULL,
        PostedAt DATETIME2(0) NULL,
        PostedBy UNIQUEIDENTIFIER NULL,
        CancelledAt DATETIME2(0) NULL,
        CancelledBy UNIQUEIDENTIFIER NULL,
        CancellationReason NVARCHAR(500) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_ap_SupplierPayments_IsActive DEFAULT (1),
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_ap_SupplierPayments_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(0) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_ap_SupplierPayments PRIMARY KEY (SupplierPaymentId),
        CONSTRAINT FK_ap_SupplierPayments_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_ap_SupplierPayments_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_ap_SupplierPayments_Suppliers FOREIGN KEY (SupplierId)
            REFERENCES purchasing.Suppliers (SupplierId),
        CONSTRAINT CK_ap_SupplierPayments_Status CHECK (
            Status IN ('DRAFT', 'POSTED', 'CANCELLED')
        ),
        CONSTRAINT CK_ap_SupplierPayments_TotalAmount CHECK (TotalAmount > 0)
    );
END;
GO

IF OBJECT_ID('ap.SupplierPayments', 'U') IS NOT NULL
   AND COL_LENGTH('ap.SupplierPayments', 'PaymentMethod') IS NULL
BEGIN
    ALTER TABLE ap.SupplierPayments
        ADD PaymentMethod NVARCHAR(40) NOT NULL
            CONSTRAINT DF_ap_SupplierPayments_PaymentMethod DEFAULT 'MANUAL';
END;
GO

IF OBJECT_ID('ap.SupplierPayments', 'U') IS NOT NULL
   AND COL_LENGTH('ap.SupplierPayments', 'CancelledAt') IS NULL
BEGIN
    ALTER TABLE ap.SupplierPayments
        ADD CancelledAt DATETIME2(0) NULL;
END;
GO

IF OBJECT_ID('ap.SupplierPayments', 'U') IS NOT NULL
   AND COL_LENGTH('ap.SupplierPayments', 'CancelledBy') IS NULL
BEGIN
    ALTER TABLE ap.SupplierPayments
        ADD CancelledBy UNIQUEIDENTIFIER NULL;
END;
GO

IF OBJECT_ID('ap.SupplierPayments', 'U') IS NOT NULL
   AND COL_LENGTH('ap.SupplierPayments', 'CancellationReason') IS NULL
BEGIN
    ALTER TABLE ap.SupplierPayments
        ADD CancellationReason NVARCHAR(500) NULL;
END;
GO

IF OBJECT_ID('ap.SupplierPayments', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.check_constraints
       WHERE parent_object_id = OBJECT_ID('ap.SupplierPayments')
         AND name = 'CK_ap_SupplierPayments_Status'
   )
BEGIN
    ALTER TABLE ap.SupplierPayments
        ADD CONSTRAINT CK_ap_SupplierPayments_Status CHECK (
            Status IN ('DRAFT', 'POSTED', 'CANCELLED')
        );
END;
GO

IF OBJECT_ID('ap.SupplierPayments', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.check_constraints
       WHERE parent_object_id = OBJECT_ID('ap.SupplierPayments')
         AND name = 'CK_ap_SupplierPayments_TotalAmount'
   )
BEGIN
    ALTER TABLE ap.SupplierPayments
        ADD CONSTRAINT CK_ap_SupplierPayments_TotalAmount CHECK (TotalAmount > 0);
END;
GO

IF OBJECT_ID('ap.SupplierPaymentApplications', 'U') IS NULL
BEGIN
    CREATE TABLE ap.SupplierPaymentApplications (
        SupplierPaymentApplicationId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_ap_SupplierPaymentApplications_SupplierPaymentApplicationId DEFAULT NEWSEQUENTIALID(),
        SupplierPaymentId UNIQUEIDENTIFIER NOT NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        LineNumber INT NOT NULL,
        AccountsPayableDocumentId UNIQUEIDENTIFIER NOT NULL,
        AppliedAmount DECIMAL(18, 4) NOT NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_ap_SupplierPaymentApplications_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(0) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_ap_SupplierPaymentApplications PRIMARY KEY (SupplierPaymentApplicationId),
        CONSTRAINT FK_ap_SupplierPaymentApplications_Payments FOREIGN KEY (SupplierPaymentId)
            REFERENCES ap.SupplierPayments (SupplierPaymentId),
        CONSTRAINT FK_ap_SupplierPaymentApplications_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_ap_SupplierPaymentApplications_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_ap_SupplierPaymentApplications_Documents FOREIGN KEY (AccountsPayableDocumentId)
            REFERENCES ap.AccountsPayableDocuments (AccountsPayableDocumentId),
        CONSTRAINT CK_ap_SupplierPaymentApplications_AppliedAmount CHECK (AppliedAmount > 0)
    );
END;
GO

IF OBJECT_ID('ap.SupplierPaymentApplications', 'U') IS NOT NULL
   AND COL_LENGTH('ap.SupplierPaymentApplications', 'LineNumber') IS NULL
BEGIN
    ALTER TABLE ap.SupplierPaymentApplications
        ADD LineNumber INT NULL;

    EXEC('
        WITH numbered AS (
            SELECT
                SupplierPaymentApplicationId,
                ROW_NUMBER() OVER (
                    PARTITION BY SupplierPaymentId
                    ORDER BY CreatedAt, SupplierPaymentApplicationId
                ) AS NextLineNumber
            FROM ap.SupplierPaymentApplications
        )
        UPDATE application
        SET LineNumber = numbered.NextLineNumber
        FROM ap.SupplierPaymentApplications application
        INNER JOIN numbered
            ON numbered.SupplierPaymentApplicationId = application.SupplierPaymentApplicationId;
    ');

    ALTER TABLE ap.SupplierPaymentApplications
        ALTER COLUMN LineNumber INT NOT NULL;
END;
GO

IF OBJECT_ID('ap.SupplierPaymentApplications', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.check_constraints
       WHERE parent_object_id = OBJECT_ID('ap.SupplierPaymentApplications')
         AND name = 'CK_ap_SupplierPaymentApplications_AppliedAmount'
   )
BEGIN
    ALTER TABLE ap.SupplierPaymentApplications
        ADD CONSTRAINT CK_ap_SupplierPaymentApplications_AppliedAmount CHECK (AppliedAmount > 0);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ap.SupplierPayments')
      AND name = 'UX_ap_SupplierPayments_Tenant_Company_Number'
)
BEGIN
    CREATE UNIQUE INDEX UX_ap_SupplierPayments_Tenant_Company_Number
        ON ap.SupplierPayments (TenantId, CompanyId, PaymentNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ap.SupplierPayments')
      AND name = 'IX_ap_SupplierPayments_Tenant_Company_Supplier_Status'
)
BEGIN
    CREATE INDEX IX_ap_SupplierPayments_Tenant_Company_Supplier_Status
        ON ap.SupplierPayments (TenantId, CompanyId, SupplierId, Status);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ap.SupplierPaymentApplications')
      AND name = 'UX_ap_SupplierPaymentApplications_Payment_Document'
)
BEGIN
    CREATE UNIQUE INDEX UX_ap_SupplierPaymentApplications_Payment_Document
        ON ap.SupplierPaymentApplications (SupplierPaymentId, AccountsPayableDocumentId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ap.SupplierPaymentApplications')
      AND name = 'UX_ap_SupplierPaymentApplications_Payment_Line'
)
BEGIN
    CREATE UNIQUE INDEX UX_ap_SupplierPaymentApplications_Payment_Line
        ON ap.SupplierPaymentApplications (SupplierPaymentId, LineNumber);
END;
GO

CREATE OR ALTER VIEW ap.V_SupplierPaymentSummary
AS
SELECT
    payment.SupplierPaymentId,
    payment.TenantId,
    payment.CompanyId,
    payment.PaymentNumber,
    payment.SupplierId,
    supplier.Code AS SupplierCode,
    supplier.Name AS SupplierName,
    payment.PaymentDate,
    payment.Status,
    payment.PaymentMethod,
    payment.TotalAmount,
    COALESCE(applications.AppliedAmount, 0) AS AppliedAmount,
    payment.TotalAmount - COALESCE(applications.AppliedAmount, 0) AS UnappliedAmount,
    COALESCE(applications.ApplicationCount, 0) AS ApplicationCount,
    payment.Reference,
    payment.Notes,
    payment.PostedAt,
    payment.CancelledAt,
    payment.IsActive,
    payment.CreatedAt,
    payment.UpdatedAt,
    payment.CreatedBy,
    payment.UpdatedBy
FROM ap.SupplierPayments payment
INNER JOIN purchasing.Suppliers supplier
    ON supplier.SupplierId = payment.SupplierId
LEFT JOIN (
    SELECT
        SupplierPaymentId,
        SUM(AppliedAmount) AS AppliedAmount,
        COUNT(1) AS ApplicationCount
    FROM ap.SupplierPaymentApplications
    GROUP BY SupplierPaymentId
) applications
    ON applications.SupplierPaymentId = payment.SupplierPaymentId;
GO

CREATE OR ALTER VIEW ap.V_SupplierPaymentApplicationSummary
AS
SELECT
    application.SupplierPaymentApplicationId,
    application.SupplierPaymentId,
    payment.PaymentNumber,
    application.TenantId,
    application.CompanyId,
    application.LineNumber,
    application.AccountsPayableDocumentId,
    document.DocumentNumber,
    document.SourceDocumentNumber,
    payment.SupplierId,
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
FROM ap.SupplierPaymentApplications application
INNER JOIN ap.SupplierPayments payment
    ON payment.SupplierPaymentId = application.SupplierPaymentId
INNER JOIN ap.AccountsPayableDocuments document
    ON document.AccountsPayableDocumentId = application.AccountsPayableDocumentId
INNER JOIN purchasing.Suppliers supplier
    ON supplier.SupplierId = payment.SupplierId;
GO
