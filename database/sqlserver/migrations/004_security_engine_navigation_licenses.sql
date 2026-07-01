IF OBJECT_ID('security.NavigationItems', 'U') IS NULL
BEGIN
  CREATE TABLE security.NavigationItems (
    NavigationId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_security_NavigationItems_NavigationId DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NULL,
    ModuleId UNIQUEIDENTIFIER NULL,
    ParentNavigationId UNIQUEIDENTIFIER NULL,
    Label NVARCHAR(160) NOT NULL,
    Route NVARCHAR(250) NULL,
    Icon NVARCHAR(80) NULL,
    DisplayOrder INT NOT NULL CONSTRAINT DF_security_NavigationItems_DisplayOrder DEFAULT 0,
    IsVisible BIT NOT NULL CONSTRAINT DF_security_NavigationItems_IsVisible DEFAULT 1,
    IsActive BIT NOT NULL CONSTRAINT DF_security_NavigationItems_IsActive DEFAULT 1,
    RequiredPermissionCode NVARCHAR(180) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_security_NavigationItems_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CONSTRAINT PK_security_NavigationItems PRIMARY KEY (NavigationId),
    CONSTRAINT FK_security_NavigationItems_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
    CONSTRAINT FK_security_NavigationItems_Modules FOREIGN KEY (ModuleId) REFERENCES security.Modules (ModuleId),
    CONSTRAINT FK_security_NavigationItems_Parent FOREIGN KEY (ParentNavigationId) REFERENCES security.NavigationItems (NavigationId)
  );
END;
GO

IF OBJECT_ID('security.AccessPolicies', 'U') IS NULL
BEGIN
  CREATE TABLE security.AccessPolicies (
    PolicyId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_security_AccessPolicies_PolicyId DEFAULT NEWID(),
    Code NVARCHAR(80) NOT NULL,
    Name NVARCHAR(160) NOT NULL,
    Description NVARCHAR(250) NULL,
    ScopeCode NVARCHAR(40) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_security_AccessPolicies_IsActive DEFAULT 1,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_security_AccessPolicies_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CONSTRAINT PK_security_AccessPolicies PRIMARY KEY (PolicyId),
    CONSTRAINT UQ_security_AccessPolicies_Code UNIQUE (Code),
    CONSTRAINT CK_security_AccessPolicies_Scope CHECK (ScopeCode IN ('OWN_RECORDS', 'BRANCH_ONLY', 'COMPANY_ONLY', 'TENANT_WIDE'))
  );
END;
GO

IF OBJECT_ID('security.RolePolicies', 'U') IS NULL
BEGIN
  CREATE TABLE security.RolePolicies (
    TenantId UNIQUEIDENTIFIER NOT NULL,
    RoleId UNIQUEIDENTIFIER NOT NULL,
    PolicyId UNIQUEIDENTIFIER NOT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_security_RolePolicies_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_security_RolePolicies PRIMARY KEY (TenantId, RoleId, PolicyId),
    CONSTRAINT FK_security_RolePolicies_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
    CONSTRAINT FK_security_RolePolicies_Roles FOREIGN KEY (RoleId) REFERENCES security.Roles (RoleId),
    CONSTRAINT FK_security_RolePolicies_Policies FOREIGN KEY (PolicyId) REFERENCES security.AccessPolicies (PolicyId)
  );
END;
GO

IF OBJECT_ID('security.TenantModuleLicenses', 'U') IS NULL
BEGIN
  CREATE TABLE security.TenantModuleLicenses (
    LicenseId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_security_TenantModuleLicenses_LicenseId DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    ModuleId UNIQUEIDENTIFIER NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_security_TenantModuleLicenses_IsActive DEFAULT 1,
    StartsAt DATETIME2(0) NULL,
    ExpiresAt DATETIME2(0) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_security_TenantModuleLicenses_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CONSTRAINT PK_security_TenantModuleLicenses PRIMARY KEY (LicenseId),
    CONSTRAINT FK_security_TenantModuleLicenses_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
    CONSTRAINT FK_security_TenantModuleLicenses_Modules FOREIGN KEY (ModuleId) REFERENCES security.Modules (ModuleId),
    CONSTRAINT UQ_security_TenantModuleLicenses_Tenant_Module UNIQUE (TenantId, ModuleId)
  );
END;
GO

IF OBJECT_ID('security.FeatureFlags', 'U') IS NULL
BEGIN
  CREATE TABLE security.FeatureFlags (
    FlagId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_security_FeatureFlags_FlagId DEFAULT NEWID(),
    Code NVARCHAR(120) NOT NULL,
    Name NVARCHAR(160) NOT NULL,
    Description NVARCHAR(250) NULL,
    IsEnabled BIT NOT NULL CONSTRAINT DF_security_FeatureFlags_IsEnabled DEFAULT 0,
    IsActive BIT NOT NULL CONSTRAINT DF_security_FeatureFlags_IsActive DEFAULT 1,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_security_FeatureFlags_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CONSTRAINT PK_security_FeatureFlags PRIMARY KEY (FlagId),
    CONSTRAINT UQ_security_FeatureFlags_Code UNIQUE (Code)
  );
END;
GO

IF OBJECT_ID('security.TenantFeatureFlags', 'U') IS NULL
BEGIN
  CREATE TABLE security.TenantFeatureFlags (
    TenantFeatureFlagId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_security_TenantFeatureFlags_Id DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    FlagId UNIQUEIDENTIFIER NOT NULL,
    IsEnabled BIT NOT NULL CONSTRAINT DF_security_TenantFeatureFlags_IsEnabled DEFAULT 0,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_security_TenantFeatureFlags_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CONSTRAINT PK_security_TenantFeatureFlags PRIMARY KEY (TenantFeatureFlagId),
    CONSTRAINT FK_security_TenantFeatureFlags_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
    CONSTRAINT FK_security_TenantFeatureFlags_Flags FOREIGN KEY (FlagId) REFERENCES security.FeatureFlags (FlagId),
    CONSTRAINT UQ_security_TenantFeatureFlags_Tenant_Flag UNIQUE (TenantId, FlagId)
  );
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_security_NavigationItems_Tenant_Module'
    AND object_id = OBJECT_ID('security.NavigationItems')
)
BEGIN
  CREATE INDEX IX_security_NavigationItems_Tenant_Module
    ON security.NavigationItems (TenantId, ModuleId, IsActive, DisplayOrder);
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_security_TenantModuleLicenses_Tenant_Active'
    AND object_id = OBJECT_ID('security.TenantModuleLicenses')
)
BEGIN
  CREATE INDEX IX_security_TenantModuleLicenses_Tenant_Active
    ON security.TenantModuleLicenses (TenantId, IsActive, StartsAt, ExpiresAt);
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_security_TenantFeatureFlags_Tenant'
    AND object_id = OBJECT_ID('security.TenantFeatureFlags')
)
BEGIN
  CREATE INDEX IX_security_TenantFeatureFlags_Tenant
    ON security.TenantFeatureFlags (TenantId, IsEnabled);
END;
GO
