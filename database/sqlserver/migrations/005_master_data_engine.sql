IF OBJECT_ID('core.Currencies', 'U') IS NULL
BEGIN
  CREATE TABLE core.Currencies (
    CurrencyId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_core_Currencies_CurrencyId DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    CompanyId UNIQUEIDENTIFIER NULL,
    Code NVARCHAR(20) NOT NULL,
    Name NVARCHAR(160) NOT NULL,
    Description NVARCHAR(250) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_core_Currencies_IsActive DEFAULT 1,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_core_Currencies_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CreatedBy UNIQUEIDENTIFIER NULL,
    UpdatedBy UNIQUEIDENTIFIER NULL,
    CONSTRAINT PK_core_Currencies PRIMARY KEY (CurrencyId),
    CONSTRAINT FK_core_Currencies_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
    CONSTRAINT FK_core_Currencies_Companies FOREIGN KEY (CompanyId) REFERENCES core.Companies (CompanyId),
    CONSTRAINT UQ_core_Currencies_Tenant_Company_Code UNIQUE (TenantId, CompanyId, Code)
  );
END;
GO

IF OBJECT_ID('core.PaymentTerms', 'U') IS NULL
BEGIN
  CREATE TABLE core.PaymentTerms (
    PaymentTermId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_core_PaymentTerms_PaymentTermId DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    CompanyId UNIQUEIDENTIFIER NULL,
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(160) NOT NULL,
    Description NVARCHAR(250) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_core_PaymentTerms_IsActive DEFAULT 1,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_core_PaymentTerms_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CreatedBy UNIQUEIDENTIFIER NULL,
    UpdatedBy UNIQUEIDENTIFIER NULL,
    CONSTRAINT PK_core_PaymentTerms PRIMARY KEY (PaymentTermId),
    CONSTRAINT FK_core_PaymentTerms_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
    CONSTRAINT FK_core_PaymentTerms_Companies FOREIGN KEY (CompanyId) REFERENCES core.Companies (CompanyId),
    CONSTRAINT UQ_core_PaymentTerms_Tenant_Company_Code UNIQUE (TenantId, CompanyId, Code)
  );
END;
GO

IF OBJECT_ID('fiscal.TaxCategories', 'U') IS NULL
BEGIN
  CREATE TABLE fiscal.TaxCategories (
    TaxCategoryId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_fiscal_TaxCategories_TaxCategoryId DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    CompanyId UNIQUEIDENTIFIER NULL,
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(160) NOT NULL,
    Description NVARCHAR(250) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_fiscal_TaxCategories_IsActive DEFAULT 1,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_fiscal_TaxCategories_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CreatedBy UNIQUEIDENTIFIER NULL,
    UpdatedBy UNIQUEIDENTIFIER NULL,
    CONSTRAINT PK_fiscal_TaxCategories PRIMARY KEY (TaxCategoryId),
    CONSTRAINT FK_fiscal_TaxCategories_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
    CONSTRAINT FK_fiscal_TaxCategories_Companies FOREIGN KEY (CompanyId) REFERENCES core.Companies (CompanyId),
    CONSTRAINT UQ_fiscal_TaxCategories_Tenant_Company_Code UNIQUE (TenantId, CompanyId, Code)
  );
END;
GO

IF OBJECT_ID('core.UnitsOfMeasure', 'U') IS NULL
BEGIN
  CREATE TABLE core.UnitsOfMeasure (
    UnitOfMeasureId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_core_UnitsOfMeasure_UnitOfMeasureId DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    CompanyId UNIQUEIDENTIFIER NULL,
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(160) NOT NULL,
    Description NVARCHAR(250) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_core_UnitsOfMeasure_IsActive DEFAULT 1,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_core_UnitsOfMeasure_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CreatedBy UNIQUEIDENTIFIER NULL,
    UpdatedBy UNIQUEIDENTIFIER NULL,
    CONSTRAINT PK_core_UnitsOfMeasure PRIMARY KEY (UnitOfMeasureId),
    CONSTRAINT FK_core_UnitsOfMeasure_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
    CONSTRAINT FK_core_UnitsOfMeasure_Companies FOREIGN KEY (CompanyId) REFERENCES core.Companies (CompanyId),
    CONSTRAINT UQ_core_UnitsOfMeasure_Tenant_Company_Code UNIQUE (TenantId, CompanyId, Code)
  );
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_core_Currencies_Tenant_Active'
    AND object_id = OBJECT_ID('core.Currencies')
)
BEGIN
  CREATE INDEX IX_core_Currencies_Tenant_Active
    ON core.Currencies (TenantId, CompanyId, IsActive, Name);
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_core_PaymentTerms_Tenant_Active'
    AND object_id = OBJECT_ID('core.PaymentTerms')
)
BEGIN
  CREATE INDEX IX_core_PaymentTerms_Tenant_Active
    ON core.PaymentTerms (TenantId, CompanyId, IsActive, Name);
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_fiscal_TaxCategories_Tenant_Active'
    AND object_id = OBJECT_ID('fiscal.TaxCategories')
)
BEGIN
  CREATE INDEX IX_fiscal_TaxCategories_Tenant_Active
    ON fiscal.TaxCategories (TenantId, CompanyId, IsActive, Name);
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_core_UnitsOfMeasure_Tenant_Active'
    AND object_id = OBJECT_ID('core.UnitsOfMeasure')
)
BEGIN
  CREATE INDEX IX_core_UnitsOfMeasure_Tenant_Active
    ON core.UnitsOfMeasure (TenantId, CompanyId, IsActive, Name);
END;
GO
