IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'crm')
BEGIN
    EXEC('CREATE SCHEMA crm');
END;
GO

IF OBJECT_ID('crm.Customers', 'U') IS NULL
BEGIN
    CREATE TABLE crm.Customers (
        CustomerId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_crm_Customers_CustomerId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NULL,
        Code NVARCHAR(40) NOT NULL,
        Name NVARCHAR(200) NOT NULL,
        CommercialName NVARCHAR(200) NULL,
        DocumentType NVARCHAR(30) NULL,
        DocumentNumber NVARCHAR(40) NULL,
        Email NVARCHAR(200) NULL,
        Phone NVARCHAR(40) NULL,
        Mobile NVARCHAR(40) NULL,
        AddressLine1 NVARCHAR(300) NULL,
        AddressLine2 NVARCHAR(300) NULL,
        City NVARCHAR(120) NULL,
        Province NVARCHAR(120) NULL,
        CountryCode NVARCHAR(3) NULL,
        PaymentTermId UNIQUEIDENTIFIER NULL,
        CurrencyId UNIQUEIDENTIFIER NULL,
        TaxCategoryId UNIQUEIDENTIFIER NULL,
        CreditLimit DECIMAL(18,2) NULL,
        IsCreditCustomer BIT NOT NULL
            CONSTRAINT DF_crm_Customers_IsCreditCustomer DEFAULT (0),
        IsActive BIT NOT NULL
            CONSTRAINT DF_crm_Customers_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_crm_Customers_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_crm_Customers PRIMARY KEY (CustomerId),
        CONSTRAINT FK_crm_Customers_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_crm_Customers_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_crm_Customers_PaymentTerms FOREIGN KEY (PaymentTermId)
            REFERENCES core.PaymentTerms (PaymentTermId),
        CONSTRAINT FK_crm_Customers_Currencies FOREIGN KEY (CurrencyId)
            REFERENCES core.Currencies (CurrencyId),
        CONSTRAINT FK_crm_Customers_TaxCategories FOREIGN KEY (TaxCategoryId)
            REFERENCES fiscal.TaxCategories (TaxCategoryId)
    );

    CREATE UNIQUE INDEX UX_crm_Customers_Tenant_Company_Code
        ON crm.Customers (TenantId, CompanyId, Code)
        WHERE CompanyId IS NOT NULL;

    CREATE UNIQUE INDEX UX_crm_Customers_Tenant_Global_Code
        ON crm.Customers (TenantId, Code)
        WHERE CompanyId IS NULL;

    CREATE INDEX IX_crm_Customers_Tenant_Company_DocumentNumber
        ON crm.Customers (TenantId, CompanyId, DocumentNumber)
        WHERE DocumentNumber IS NOT NULL;

    CREATE INDEX IX_crm_Customers_Tenant_Company_Name
        ON crm.Customers (TenantId, CompanyId, Name);

    CREATE INDEX IX_crm_Customers_Tenant_IsActive
        ON crm.Customers (TenantId, IsActive);
END;
GO
