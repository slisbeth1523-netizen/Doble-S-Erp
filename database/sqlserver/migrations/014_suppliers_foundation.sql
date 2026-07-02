IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'purchasing')
BEGIN
    EXEC('CREATE SCHEMA purchasing');
END;
GO

IF OBJECT_ID('purchasing.Suppliers', 'U') IS NULL
BEGIN
    CREATE TABLE purchasing.Suppliers (
        SupplierId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_purchasing_Suppliers_SupplierId DEFAULT NEWSEQUENTIALID(),
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
        IsTaxWithholder BIT NOT NULL
            CONSTRAINT DF_purchasing_Suppliers_IsTaxWithholder DEFAULT (0),
        IsForeignSupplier BIT NOT NULL
            CONSTRAINT DF_purchasing_Suppliers_IsForeignSupplier DEFAULT (0),
        ContactName NVARCHAR(200) NULL,
        ContactEmail NVARCHAR(200) NULL,
        ContactPhone NVARCHAR(40) NULL,
        Notes NVARCHAR(500) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_purchasing_Suppliers_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_purchasing_Suppliers_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_purchasing_Suppliers PRIMARY KEY (SupplierId),
        CONSTRAINT FK_purchasing_Suppliers_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_purchasing_Suppliers_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_purchasing_Suppliers_PaymentTerms FOREIGN KEY (PaymentTermId)
            REFERENCES core.PaymentTerms (PaymentTermId),
        CONSTRAINT FK_purchasing_Suppliers_Currencies FOREIGN KEY (CurrencyId)
            REFERENCES core.Currencies (CurrencyId),
        CONSTRAINT FK_purchasing_Suppliers_TaxCategories FOREIGN KEY (TaxCategoryId)
            REFERENCES fiscal.TaxCategories (TaxCategoryId)
    );

    CREATE UNIQUE INDEX UX_purchasing_Suppliers_Tenant_Company_Code
        ON purchasing.Suppliers (TenantId, CompanyId, Code)
        WHERE CompanyId IS NOT NULL;

    CREATE UNIQUE INDEX UX_purchasing_Suppliers_Tenant_Global_Code
        ON purchasing.Suppliers (TenantId, Code)
        WHERE CompanyId IS NULL;

    CREATE INDEX IX_purchasing_Suppliers_Tenant_Company_DocumentNumber
        ON purchasing.Suppliers (TenantId, CompanyId, DocumentNumber)
        WHERE DocumentNumber IS NOT NULL;

    CREATE INDEX IX_purchasing_Suppliers_Tenant_Company_Name
        ON purchasing.Suppliers (TenantId, CompanyId, Name);

    CREATE INDEX IX_purchasing_Suppliers_Tenant_IsActive
        ON purchasing.Suppliers (TenantId, IsActive);
END;
GO
