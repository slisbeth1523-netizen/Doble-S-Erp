IF OBJECT_ID('security.Modules', 'U') IS NULL
BEGIN
  CREATE TABLE security.Modules (
    ModuleId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_security_Modules_ModuleId DEFAULT NEWID(),
    Code NVARCHAR(80) NOT NULL,
    Name NVARCHAR(160) NOT NULL,
    Description NVARCHAR(250) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_security_Modules_IsActive DEFAULT 1,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_security_Modules_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CONSTRAINT PK_security_Modules PRIMARY KEY (ModuleId),
    CONSTRAINT UQ_security_Modules_Code UNIQUE (Code)
  );
END;
GO

IF OBJECT_ID('security.Actions', 'U') IS NULL
BEGIN
  CREATE TABLE security.Actions (
    ActionId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_security_Actions_ActionId DEFAULT NEWID(),
    Code NVARCHAR(80) NOT NULL,
    Name NVARCHAR(160) NOT NULL,
    Description NVARCHAR(250) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_security_Actions_IsActive DEFAULT 1,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_security_Actions_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CONSTRAINT PK_security_Actions PRIMARY KEY (ActionId),
    CONSTRAINT UQ_security_Actions_Code UNIQUE (Code)
  );
END;
GO

IF COL_LENGTH('security.Roles', 'IsActive') IS NULL
BEGIN
  ALTER TABLE security.Roles
    ADD IsActive BIT NOT NULL CONSTRAINT DF_security_Roles_IsActive DEFAULT 1;
END;
GO

IF COL_LENGTH('security.Roles', 'UpdatedAt') IS NULL
BEGIN
  ALTER TABLE security.Roles
    ADD UpdatedAt DATETIME2(0) NULL;
END;
GO

IF COL_LENGTH('security.Permissions', 'UpdatedAt') IS NULL
BEGIN
  ALTER TABLE security.Permissions
    ADD UpdatedAt DATETIME2(0) NULL;
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_security_Roles_Tenant_IsActive'
    AND object_id = OBJECT_ID('security.Roles')
)
BEGIN
  CREATE INDEX IX_security_Roles_Tenant_IsActive
    ON security.Roles (TenantId, IsActive, Name);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_security_Permissions_IsActive'
    AND object_id = OBJECT_ID('security.Permissions')
)
BEGIN
  CREATE INDEX IX_security_Permissions_IsActive
    ON security.Permissions (IsActive, ModuleCode, ActionCode);
END;
GO
