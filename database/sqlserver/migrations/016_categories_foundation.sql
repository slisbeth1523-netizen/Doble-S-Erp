IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'inventory')
BEGIN
    EXEC('CREATE SCHEMA inventory');
END;
GO

IF OBJECT_ID('inventory.Categories', 'U') IS NULL
BEGIN
    CREATE TABLE inventory.Categories (
        CategoryId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_inventory_Categories_CategoryId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NULL,
        Code NVARCHAR(40) NOT NULL,
        Name NVARCHAR(160) NOT NULL,
        Description NVARCHAR(250) NULL,
        ParentCategoryId UNIQUEIDENTIFIER NULL,
        IsSalesCategory BIT NOT NULL
            CONSTRAINT DF_inventory_Categories_IsSalesCategory DEFAULT (1),
        IsPurchaseCategory BIT NOT NULL
            CONSTRAINT DF_inventory_Categories_IsPurchaseCategory DEFAULT (1),
        IsInventoryCategory BIT NOT NULL
            CONSTRAINT DF_inventory_Categories_IsInventoryCategory DEFAULT (1),
        IsActive BIT NOT NULL
            CONSTRAINT DF_inventory_Categories_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_inventory_Categories_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_inventory_Categories PRIMARY KEY (CategoryId),
        CONSTRAINT FK_inventory_Categories_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_inventory_Categories_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_inventory_Categories_ParentCategory FOREIGN KEY (ParentCategoryId)
            REFERENCES inventory.Categories (CategoryId)
    );

    CREATE UNIQUE INDEX UX_inventory_Categories_Tenant_Company_Code
        ON inventory.Categories (TenantId, CompanyId, Code)
        WHERE CompanyId IS NOT NULL;

    CREATE UNIQUE INDEX UX_inventory_Categories_Tenant_Global_Code
        ON inventory.Categories (TenantId, Code)
        WHERE CompanyId IS NULL;

    CREATE INDEX IX_inventory_Categories_Tenant_Company_Name
        ON inventory.Categories (TenantId, CompanyId, Name);

    CREATE INDEX IX_inventory_Categories_Tenant_ParentCategory
        ON inventory.Categories (TenantId, ParentCategoryId)
        WHERE ParentCategoryId IS NOT NULL;

    CREATE INDEX IX_inventory_Categories_Tenant_IsActive
        ON inventory.Categories (TenantId, IsActive);
END;
GO

IF OBJECT_ID('inventory.Items', 'U') IS NOT NULL
   AND OBJECT_ID('inventory.Categories', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_inventory_Items_Categories'
         AND parent_object_id = OBJECT_ID('inventory.Items')
   )
BEGIN
    ALTER TABLE inventory.Items
        ADD CONSTRAINT FK_inventory_Items_Categories FOREIGN KEY (CategoryId)
            REFERENCES inventory.Categories (CategoryId);
END;
GO
