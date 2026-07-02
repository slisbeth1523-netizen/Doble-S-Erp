IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'inventory')
BEGIN
    EXEC('CREATE SCHEMA inventory');
END;
GO

IF OBJECT_ID('inventory.Items', 'U') IS NULL
BEGIN
    CREATE TABLE inventory.Items (
        ItemId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_inventory_Items_ItemId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NULL,
        Code NVARCHAR(50) NOT NULL,
        Description NVARCHAR(300) NOT NULL,
        ShortDescription NVARCHAR(120) NULL,
        Barcode NVARCHAR(100) NULL,
        AlternateCode NVARCHAR(100) NULL,
        CategoryId UNIQUEIDENTIFIER NULL,
        BrandId UNIQUEIDENTIFIER NULL,
        UnitOfMeasureId UNIQUEIDENTIFIER NULL,
        TaxCategoryId UNIQUEIDENTIFIER NULL,
        InventoryType NVARCHAR(30) NOT NULL,
        ItemType NVARCHAR(30) NOT NULL,
        AllowNegativeInventory BIT NOT NULL
            CONSTRAINT DF_inventory_Items_AllowNegativeInventory DEFAULT (0),
        TrackInventory BIT NOT NULL
            CONSTRAINT DF_inventory_Items_TrackInventory DEFAULT (1),
        TrackLot BIT NOT NULL
            CONSTRAINT DF_inventory_Items_TrackLot DEFAULT (0),
        TrackSerial BIT NOT NULL
            CONSTRAINT DF_inventory_Items_TrackSerial DEFAULT (0),
        IsService BIT NOT NULL
            CONSTRAINT DF_inventory_Items_IsService DEFAULT (0),
        IsManufactured BIT NOT NULL
            CONSTRAINT DF_inventory_Items_IsManufactured DEFAULT (0),
        CostMethod NVARCHAR(30) NOT NULL,
        StandardCost DECIMAL(18,6) NULL,
        AverageCost DECIMAL(18,6) NULL,
        LastCost DECIMAL(18,6) NULL,
        BasePrice DECIMAL(18,6) NULL,
        MinimumPrice DECIMAL(18,6) NULL,
        MaximumDiscountPercent DECIMAL(9,2) NULL,
        Weight DECIMAL(18,6) NULL,
        Volume DECIMAL(18,6) NULL,
        ImageUrl NVARCHAR(500) NULL,
        Notes NVARCHAR(1000) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_inventory_Items_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_inventory_Items_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_inventory_Items PRIMARY KEY (ItemId),
        CONSTRAINT FK_inventory_Items_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_inventory_Items_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_inventory_Items_UnitsOfMeasure FOREIGN KEY (UnitOfMeasureId)
            REFERENCES core.UnitsOfMeasure (UnitOfMeasureId),
        CONSTRAINT FK_inventory_Items_TaxCategories FOREIGN KEY (TaxCategoryId)
            REFERENCES fiscal.TaxCategories (TaxCategoryId),
        CONSTRAINT CK_inventory_Items_InventoryType CHECK (
            InventoryType IN ('PRODUCT', 'SERVICE', 'RAW_MATERIAL', 'FINISHED_GOOD', 'CONSUMABLE')
        ),
        CONSTRAINT CK_inventory_Items_ItemType CHECK (
            ItemType IN ('NORMAL', 'KIT', 'BUNDLE', 'SERVICE')
        ),
        CONSTRAINT CK_inventory_Items_CostMethod CHECK (
            CostMethod IN ('AVERAGE', 'FIFO', 'LIFO_PLACEHOLDER', 'STANDARD')
        ),
        CONSTRAINT CK_inventory_Items_Costs CHECK (
            (StandardCost IS NULL OR StandardCost >= 0)
            AND (AverageCost IS NULL OR AverageCost >= 0)
            AND (LastCost IS NULL OR LastCost >= 0)
        ),
        CONSTRAINT CK_inventory_Items_Prices CHECK (
            (BasePrice IS NULL OR BasePrice >= 0)
            AND (MinimumPrice IS NULL OR MinimumPrice >= 0)
        ),
        CONSTRAINT CK_inventory_Items_MaximumDiscountPercent CHECK (
            MaximumDiscountPercent IS NULL
            OR (MaximumDiscountPercent >= 0 AND MaximumDiscountPercent <= 100)
        ),
        CONSTRAINT CK_inventory_Items_Measures CHECK (
            (Weight IS NULL OR Weight >= 0)
            AND (Volume IS NULL OR Volume >= 0)
        )
    );

    CREATE UNIQUE INDEX UX_inventory_Items_Tenant_Company_Code
        ON inventory.Items (TenantId, CompanyId, Code)
        WHERE CompanyId IS NOT NULL;

    CREATE UNIQUE INDEX UX_inventory_Items_Tenant_Global_Code
        ON inventory.Items (TenantId, Code)
        WHERE CompanyId IS NULL;

    CREATE INDEX IX_inventory_Items_Tenant_Company_Barcode
        ON inventory.Items (TenantId, CompanyId, Barcode)
        WHERE Barcode IS NOT NULL;

    CREATE INDEX IX_inventory_Items_Tenant_Company_AlternateCode
        ON inventory.Items (TenantId, CompanyId, AlternateCode)
        WHERE AlternateCode IS NOT NULL;

    CREATE INDEX IX_inventory_Items_Tenant_Company_Description
        ON inventory.Items (TenantId, CompanyId, Description);

    CREATE INDEX IX_inventory_Items_Tenant_Company_Category
        ON inventory.Items (TenantId, CompanyId, CategoryId)
        WHERE CategoryId IS NOT NULL;

    CREATE INDEX IX_inventory_Items_Tenant_Company_Brand
        ON inventory.Items (TenantId, CompanyId, BrandId)
        WHERE BrandId IS NOT NULL;

    CREATE INDEX IX_inventory_Items_Tenant_IsActive
        ON inventory.Items (TenantId, IsActive);
END;
GO

-- TODO: Add FK to inventory.Categories when that catalog table exists.
IF OBJECT_ID('inventory.Categories', 'U') IS NOT NULL
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

-- TODO: Add FK to inventory.Brands when that catalog table exists.
IF OBJECT_ID('inventory.Brands', 'U') IS NOT NULL
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
