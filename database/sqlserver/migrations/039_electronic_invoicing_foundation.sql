IF COL_LENGTH('fiscal.CompanyFiscalSettings', 'ElectronicInvoicingEnvironment') IS NULL
BEGIN
    ALTER TABLE fiscal.CompanyFiscalSettings
        ADD ElectronicInvoicingEnvironment NVARCHAR(20) NOT NULL
            CONSTRAINT DF_fiscal_CompanyFiscalSettings_ECFEnvironment DEFAULT 'TESTECF';
END;
GO

IF COL_LENGTH('fiscal.CompanyFiscalSettings', 'CertificateAlias') IS NULL
BEGIN
    ALTER TABLE fiscal.CompanyFiscalSettings
        ADD CertificateAlias NVARCHAR(160) NULL;
END;
GO

IF COL_LENGTH('fiscal.CompanyFiscalSettings', 'CertificateData') IS NULL
BEGIN
    ALTER TABLE fiscal.CompanyFiscalSettings
        ADD CertificateData NVARCHAR(MAX) NULL;
END;
GO

IF OBJECT_ID('fiscal.ElectronicInvoiceSequences', 'U') IS NULL
BEGIN
    CREATE TABLE fiscal.ElectronicInvoiceSequences (
        ElectronicInvoiceSequenceId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_fiscal_ElectronicInvoiceSequences_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        InvoiceType NVARCHAR(2) NOT NULL,
        Prefix NVARCHAR(3) NOT NULL,
        RangeFrom BIGINT NOT NULL,
        RangeTo BIGINT NOT NULL,
        NextNumber BIGINT NOT NULL,
        ExpirationDate DATE NULL,
        Environment NVARCHAR(20) NOT NULL
            CONSTRAINT DF_fiscal_ElectronicInvoiceSequences_Environment DEFAULT 'TESTECF',
        IsActive BIT NOT NULL
            CONSTRAINT DF_fiscal_ElectronicInvoiceSequences_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_fiscal_ElectronicInvoiceSequences_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_fiscal_ElectronicInvoiceSequences PRIMARY KEY (ElectronicInvoiceSequenceId),
        CONSTRAINT FK_fiscal_ElectronicInvoiceSequences_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_fiscal_ElectronicInvoiceSequences_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT CK_fiscal_ElectronicInvoiceSequences_Type CHECK (InvoiceType IN ('31','32','33','34','41','43','44','45','46','47')),
        CONSTRAINT CK_fiscal_ElectronicInvoiceSequences_Range CHECK (RangeFrom > 0 AND RangeTo >= RangeFrom AND NextNumber BETWEEN RangeFrom AND RangeTo + 1),
        CONSTRAINT CK_fiscal_ElectronicInvoiceSequences_Prefix CHECK (Prefix LIKE 'E[0-9][0-9]'),
        CONSTRAINT CK_fiscal_ElectronicInvoiceSequences_Environment CHECK (Environment IN ('TESTECF','CERTECF','PRODUCCION'))
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_fiscal_ElectronicInvoiceSequences_Active_Type'
      AND object_id = OBJECT_ID('fiscal.ElectronicInvoiceSequences')
)
BEGIN
    CREATE UNIQUE INDEX UX_fiscal_ElectronicInvoiceSequences_Active_Type
        ON fiscal.ElectronicInvoiceSequences (TenantId, CompanyId, Environment, InvoiceType)
        WHERE IsActive = 1;
END;
GO

IF OBJECT_ID('fiscal.ElectronicInvoices', 'U') IS NULL
BEGIN
    CREATE TABLE fiscal.ElectronicInvoices (
        ElectronicInvoiceId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_fiscal_ElectronicInvoices_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        SourceModule NVARCHAR(40) NOT NULL,
        SourceInvoiceId UNIQUEIDENTIFIER NOT NULL,
        InvoiceType NVARCHAR(2) NOT NULL,
        EcfNumber NVARCHAR(13) NOT NULL,
        Environment NVARCHAR(20) NOT NULL,
        TrackId NVARCHAR(80) NULL,
        Status NVARCHAR(30) NOT NULL
            CONSTRAINT DF_fiscal_ElectronicInvoices_Status DEFAULT 'GENERATED',
        XmlContent NVARCHAR(MAX) NOT NULL,
        SignedXml NVARCHAR(MAX) NULL,
        DgiiResponseJson NVARCHAR(MAX) NULL,
        TotalAmount DECIMAL(18,4) NOT NULL,
        IssuedAt DATETIME2(7) NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_fiscal_ElectronicInvoices_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_fiscal_ElectronicInvoices PRIMARY KEY (ElectronicInvoiceId),
        CONSTRAINT FK_fiscal_ElectronicInvoices_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_fiscal_ElectronicInvoices_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_fiscal_ElectronicInvoices_SalesInvoices FOREIGN KEY (SourceInvoiceId)
            REFERENCES sales.SalesInvoices (SalesInvoiceId),
        CONSTRAINT CK_fiscal_ElectronicInvoices_Type CHECK (InvoiceType IN ('31','32','33','34','41','43','44','45','46','47')),
        CONSTRAINT CK_fiscal_ElectronicInvoices_Status CHECK (Status IN ('GENERATED','SIGNED','SENT','ACCEPTED','ACCEPTED_CONDITIONAL','REJECTED','PENDING')),
        CONSTRAINT CK_fiscal_ElectronicInvoices_Environment CHECK (Environment IN ('TESTECF','CERTECF','PRODUCCION'))
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_fiscal_ElectronicInvoices_Source'
      AND object_id = OBJECT_ID('fiscal.ElectronicInvoices')
)
BEGIN
    CREATE UNIQUE INDEX UX_fiscal_ElectronicInvoices_Source
        ON fiscal.ElectronicInvoices (TenantId, CompanyId, SourceModule, SourceInvoiceId);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_fiscal_ElectronicInvoices_EcfNumber'
      AND object_id = OBJECT_ID('fiscal.ElectronicInvoices')
)
BEGIN
    CREATE UNIQUE INDEX UX_fiscal_ElectronicInvoices_EcfNumber
        ON fiscal.ElectronicInvoices (TenantId, CompanyId, EcfNumber);
END;
GO

IF OBJECT_ID('fiscal.ElectronicCertificationSteps', 'U') IS NULL
BEGIN
    CREATE TABLE fiscal.ElectronicCertificationSteps (
        ElectronicCertificationStepId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_fiscal_ElectronicCertificationSteps_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        StepNumber INT NOT NULL,
        EcfType NVARCHAR(20) NOT NULL,
        Description NVARCHAR(500) NOT NULL,
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_fiscal_ElectronicCertificationSteps_Status DEFAULT 'PENDING',
        TrackId NVARCHAR(80) NULL,
        Response NVARCHAR(MAX) NULL,
        UpdatedAt DATETIME2(7) NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_fiscal_ElectronicCertificationSteps PRIMARY KEY (ElectronicCertificationStepId),
        CONSTRAINT FK_fiscal_ElectronicCertificationSteps_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_fiscal_ElectronicCertificationSteps_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT UQ_fiscal_ElectronicCertificationSteps_Step UNIQUE (TenantId, CompanyId, StepNumber),
        CONSTRAINT CK_fiscal_ElectronicCertificationSteps_Status CHECK (Status IN ('PENDING','RUNNING','PASSED','FAILED'))
    );
END;
GO

CREATE OR ALTER VIEW fiscal.V_ElectronicInvoiceSummary AS
SELECT
    electronicInvoice.ElectronicInvoiceId,
    electronicInvoice.TenantId,
    electronicInvoice.CompanyId,
    electronicInvoice.SourceModule,
    electronicInvoice.SourceInvoiceId,
    salesInvoice.InvoiceNumber AS SourceInvoiceNumber,
    company.LegalName AS CompanyName,
    electronicInvoice.InvoiceType,
    electronicInvoice.EcfNumber,
    electronicInvoice.Environment,
    electronicInvoice.TrackId,
    electronicInvoice.Status,
    electronicInvoice.TotalAmount,
    electronicInvoice.IssuedAt,
    electronicInvoice.CreatedAt,
    electronicInvoice.UpdatedAt,
    electronicInvoice.CreatedBy,
    electronicInvoice.UpdatedBy
FROM fiscal.ElectronicInvoices electronicInvoice
INNER JOIN core.Companies company
    ON company.CompanyId = electronicInvoice.CompanyId
INNER JOIN sales.SalesInvoices salesInvoice
    ON salesInvoice.SalesInvoiceId = electronicInvoice.SourceInvoiceId;
GO

CREATE OR ALTER VIEW fiscal.V_ElectronicInvoiceSequenceSummary AS
SELECT
    sequence.ElectronicInvoiceSequenceId,
    sequence.TenantId,
    sequence.CompanyId,
    sequence.InvoiceType,
    sequence.Prefix,
    sequence.RangeFrom,
    sequence.RangeTo,
    sequence.NextNumber,
    sequence.ExpirationDate,
    sequence.Environment,
    sequence.IsActive,
    sequence.CreatedAt,
    sequence.UpdatedAt,
    sequence.CreatedBy,
    sequence.UpdatedBy
FROM fiscal.ElectronicInvoiceSequences sequence;
GO
