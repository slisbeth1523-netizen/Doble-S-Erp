IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'inventory')
BEGIN
    EXEC('CREATE SCHEMA inventory');
END;
GO

IF OBJECT_ID('inventory.Warehouses', 'U') IS NULL
BEGIN
    CREATE TABLE inventory.Warehouses (
        WarehouseId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_inventory_Warehouses_WarehouseId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NULL,
        Code NVARCHAR(40) NOT NULL,
        Name NVARCHAR(160) NOT NULL,
        Description NVARCHAR(250) NULL,
        WarehouseType NVARCHAR(40) NOT NULL
            CONSTRAINT DF_inventory_Warehouses_WarehouseType DEFAULT ('NORMAL'),
        AddressLine1 NVARCHAR(250) NULL,
        AddressLine2 NVARCHAR(250) NULL,
        City NVARCHAR(120) NULL,
        Province NVARCHAR(120) NULL,
        CountryCode NVARCHAR(3) NULL,
        ResponsibleUserId UNIQUEIDENTIFIER NULL,
        AllowsNegativeInventory BIT NOT NULL
            CONSTRAINT DF_inventory_Warehouses_AllowsNegativeInventory DEFAULT (0),
        IsDefault BIT NOT NULL
            CONSTRAINT DF_inventory_Warehouses_IsDefault DEFAULT (0),
        IsTransit BIT NOT NULL
            CONSTRAINT DF_inventory_Warehouses_IsTransit DEFAULT (0),
        IsVirtual BIT NOT NULL
            CONSTRAINT DF_inventory_Warehouses_IsVirtual DEFAULT (0),
        IsActive BIT NOT NULL
            CONSTRAINT DF_inventory_Warehouses_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_inventory_Warehouses_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_inventory_Warehouses PRIMARY KEY (WarehouseId),
        CONSTRAINT FK_inventory_Warehouses_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_inventory_Warehouses_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT CK_inventory_Warehouses_WarehouseType CHECK (
            WarehouseType IN ('NORMAL', 'PRODUCTION', 'CONSIGNMENT', 'TRANSIT', 'VIRTUAL')
        )
    );
END;
GO

IF OBJECT_ID('security.Users', 'U') IS NOT NULL
   AND OBJECT_ID('inventory.Warehouses', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_inventory_Warehouses_ResponsibleUser'
         AND parent_object_id = OBJECT_ID('inventory.Warehouses')
   )
BEGIN
    ALTER TABLE inventory.Warehouses
        ADD CONSTRAINT FK_inventory_Warehouses_ResponsibleUser FOREIGN KEY (ResponsibleUserId)
            REFERENCES security.Users (UserId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.Warehouses')
      AND name = 'UX_inventory_Warehouses_Tenant_Company_Code'
)
BEGIN
    CREATE UNIQUE INDEX UX_inventory_Warehouses_Tenant_Company_Code
        ON inventory.Warehouses (TenantId, CompanyId, Code)
        WHERE CompanyId IS NOT NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.Warehouses')
      AND name = 'UX_inventory_Warehouses_Tenant_Global_Code'
)
BEGIN
    CREATE UNIQUE INDEX UX_inventory_Warehouses_Tenant_Global_Code
        ON inventory.Warehouses (TenantId, Code)
        WHERE CompanyId IS NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.Warehouses')
      AND name = 'IX_inventory_Warehouses_Tenant_Company_Name'
)
BEGIN
    CREATE INDEX IX_inventory_Warehouses_Tenant_Company_Name
        ON inventory.Warehouses (TenantId, CompanyId, Name);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.Warehouses')
      AND name = 'IX_inventory_Warehouses_Tenant_IsActive'
)
BEGIN
    CREATE INDEX IX_inventory_Warehouses_Tenant_IsActive
        ON inventory.Warehouses (TenantId, IsActive);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.Warehouses')
      AND name = 'IX_inventory_Warehouses_Tenant_Company_IsDefault'
)
BEGIN
    CREATE INDEX IX_inventory_Warehouses_Tenant_Company_IsDefault
        ON inventory.Warehouses (TenantId, CompanyId, IsDefault);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.Warehouses')
      AND name = 'UX_inventory_Warehouses_Tenant_Company_Default'
)
BEGIN
    CREATE UNIQUE INDEX UX_inventory_Warehouses_Tenant_Company_Default
        ON inventory.Warehouses (TenantId, CompanyId)
        WHERE CompanyId IS NOT NULL AND IsDefault = 1;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.Warehouses')
      AND name = 'UX_inventory_Warehouses_Tenant_Global_Default'
)
BEGIN
    CREATE UNIQUE INDEX UX_inventory_Warehouses_Tenant_Global_Default
        ON inventory.Warehouses (TenantId)
        WHERE CompanyId IS NULL AND IsDefault = 1;
END;
GO

IF OBJECT_ID('inventory.Items', 'U') IS NOT NULL
   AND COL_LENGTH('inventory.Items', 'DefaultWarehouseId') IS NULL
BEGIN
    ALTER TABLE inventory.Items
        ADD DefaultWarehouseId UNIQUEIDENTIFIER NULL;
END;
GO

IF OBJECT_ID('inventory.Items', 'U') IS NOT NULL
   AND OBJECT_ID('inventory.Warehouses', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_inventory_Items_DefaultWarehouse'
         AND parent_object_id = OBJECT_ID('inventory.Items')
   )
BEGIN
    ALTER TABLE inventory.Items
        ADD CONSTRAINT FK_inventory_Items_DefaultWarehouse FOREIGN KEY (DefaultWarehouseId)
            REFERENCES inventory.Warehouses (WarehouseId);
END;
GO
