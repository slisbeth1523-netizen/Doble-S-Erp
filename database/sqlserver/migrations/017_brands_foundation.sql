IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'inventory')
BEGIN
    EXEC('CREATE SCHEMA inventory');
END;
GO

IF OBJECT_ID('inventory.Brands', 'U') IS NULL
BEGIN
    CREATE TABLE inventory.Brands (
        BrandId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_inventory_Brands_BrandId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NULL,
        Code NVARCHAR(40) NOT NULL,
        Name NVARCHAR(160) NOT NULL,
        Description NVARCHAR(250) NULL,
        Website NVARCHAR(250) NULL,
        CountryCode NVARCHAR(3) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_inventory_Brands_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_inventory_Brands_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_inventory_Brands PRIMARY KEY (BrandId),
        CONSTRAINT FK_inventory_Brands_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_inventory_Brands_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId)
    );

    CREATE UNIQUE INDEX UX_inventory_Brands_Tenant_Company_Code
        ON inventory.Brands (TenantId, CompanyId, Code)
        WHERE CompanyId IS NOT NULL;

    CREATE UNIQUE INDEX UX_inventory_Brands_Tenant_Global_Code
        ON inventory.Brands (TenantId, Code)
        WHERE CompanyId IS NULL;

    CREATE INDEX IX_inventory_Brands_Tenant_Company_Name
        ON inventory.Brands (TenantId, CompanyId, Name);

    CREATE INDEX IX_inventory_Brands_Tenant_IsActive
        ON inventory.Brands (TenantId, IsActive);
END;
GO

IF OBJECT_ID('inventory.Items', 'U') IS NOT NULL
   AND OBJECT_ID('inventory.Brands', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_inventory_Items_Brands'
         AND parent_object_id = OBJECT_ID('inventory.Items')
   )
BEGIN
    ALTER TABLE inventory.Items
        ADD CONSTRAINT FK_inventory_Items_Brands FOREIGN KEY (BrandId)
            REFERENCES inventory.Brands (BrandId);
END;
GO
