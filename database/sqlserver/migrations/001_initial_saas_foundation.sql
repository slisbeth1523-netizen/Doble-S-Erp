IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'core')
  EXEC('CREATE SCHEMA core');
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'security')
  EXEC('CREATE SCHEMA security');
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'fiscal')
  EXEC('CREATE SCHEMA fiscal');
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'audit')
  EXEC('CREATE SCHEMA audit');
GO

CREATE TABLE core.Tenants (
  TenantId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_core_Tenants_TenantId DEFAULT NEWID(),
  Name NVARCHAR(200) NOT NULL,
  Slug NVARCHAR(120) NOT NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_core_Tenants_IsActive DEFAULT 1,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_core_Tenants_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NULL,
  CONSTRAINT PK_core_Tenants PRIMARY KEY (TenantId),
  CONSTRAINT UQ_core_Tenants_Slug UNIQUE (Slug)
);
GO

CREATE TABLE core.Companies (
  CompanyId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_core_Companies_CompanyId DEFAULT NEWID(),
  TenantId UNIQUEIDENTIFIER NOT NULL,
  LegalName NVARCHAR(250) NOT NULL,
  TradeName NVARCHAR(250) NULL,
  TaxId NVARCHAR(32) NULL,
  FiscalCountryCode CHAR(2) NOT NULL CONSTRAINT DF_core_Companies_FiscalCountryCode DEFAULT 'DO',
  IsActive BIT NOT NULL CONSTRAINT DF_core_Companies_IsActive DEFAULT 1,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_core_Companies_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NULL,
  CONSTRAINT PK_core_Companies PRIMARY KEY (CompanyId),
  CONSTRAINT FK_core_Companies_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
  CONSTRAINT UQ_core_Companies_Tenant_TaxId UNIQUE (TenantId, TaxId)
);
GO

CREATE TABLE core.Branches (
  BranchId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_core_Branches_BranchId DEFAULT NEWID(),
  TenantId UNIQUEIDENTIFIER NOT NULL,
  CompanyId UNIQUEIDENTIFIER NOT NULL,
  Name NVARCHAR(200) NOT NULL,
  Code NVARCHAR(50) NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_core_Branches_IsActive DEFAULT 1,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_core_Branches_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NULL,
  CONSTRAINT PK_core_Branches PRIMARY KEY (BranchId),
  CONSTRAINT FK_core_Branches_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
  CONSTRAINT FK_core_Branches_Companies FOREIGN KEY (CompanyId) REFERENCES core.Companies (CompanyId),
  CONSTRAINT UQ_core_Branches_Company_Code UNIQUE (TenantId, CompanyId, Code)
);
GO

CREATE TABLE security.Users (
  UserId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_security_Users_UserId DEFAULT NEWID(),
  TenantId UNIQUEIDENTIFIER NOT NULL,
  DefaultCompanyId UNIQUEIDENTIFIER NULL,
  Email NVARCHAR(256) NOT NULL,
  DisplayName NVARCHAR(200) NOT NULL,
  PasswordHash NVARCHAR(255) NOT NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_security_Users_IsActive DEFAULT 1,
  LastLoginAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_security_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NULL,
  CONSTRAINT PK_security_Users PRIMARY KEY (UserId),
  CONSTRAINT FK_security_Users_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
  CONSTRAINT FK_security_Users_DefaultCompany FOREIGN KEY (DefaultCompanyId) REFERENCES core.Companies (CompanyId),
  CONSTRAINT UQ_security_Users_Tenant_Email UNIQUE (TenantId, Email)
);
GO

CREATE TABLE security.UserCompanyAccess (
  TenantId UNIQUEIDENTIFIER NOT NULL,
  UserId UNIQUEIDENTIFIER NOT NULL,
  CompanyId UNIQUEIDENTIFIER NOT NULL,
  IsDefault BIT NOT NULL CONSTRAINT DF_security_UserCompanyAccess_IsDefault DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_security_UserCompanyAccess_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_security_UserCompanyAccess PRIMARY KEY (TenantId, UserId, CompanyId),
  CONSTRAINT FK_security_UserCompanyAccess_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
  CONSTRAINT FK_security_UserCompanyAccess_Users FOREIGN KEY (UserId) REFERENCES security.Users (UserId),
  CONSTRAINT FK_security_UserCompanyAccess_Companies FOREIGN KEY (CompanyId) REFERENCES core.Companies (CompanyId)
);
GO

CREATE TABLE security.Roles (
  RoleId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_security_Roles_RoleId DEFAULT NEWID(),
  TenantId UNIQUEIDENTIFIER NOT NULL,
  Code NVARCHAR(80) NOT NULL,
  Name NVARCHAR(160) NOT NULL,
  IsSystemRole BIT NOT NULL CONSTRAINT DF_security_Roles_IsSystemRole DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_security_Roles_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_security_Roles PRIMARY KEY (RoleId),
  CONSTRAINT FK_security_Roles_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
  CONSTRAINT UQ_security_Roles_Tenant_Code UNIQUE (TenantId, Code)
);
GO

CREATE TABLE security.Permissions (
  PermissionId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_security_Permissions_PermissionId DEFAULT NEWID(),
  ModuleCode NVARCHAR(80) NOT NULL,
  ActionCode NVARCHAR(80) NOT NULL,
  Description NVARCHAR(250) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_security_Permissions_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_security_Permissions PRIMARY KEY (PermissionId),
  CONSTRAINT UQ_security_Permissions_Module_Action UNIQUE (ModuleCode, ActionCode)
);
GO

CREATE TABLE security.RolePermissions (
  TenantId UNIQUEIDENTIFIER NOT NULL,
  RoleId UNIQUEIDENTIFIER NOT NULL,
  PermissionId UNIQUEIDENTIFIER NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_security_RolePermissions_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_security_RolePermissions PRIMARY KEY (TenantId, RoleId, PermissionId),
  CONSTRAINT FK_security_RolePermissions_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
  CONSTRAINT FK_security_RolePermissions_Roles FOREIGN KEY (RoleId) REFERENCES security.Roles (RoleId),
  CONSTRAINT FK_security_RolePermissions_Permissions FOREIGN KEY (PermissionId) REFERENCES security.Permissions (PermissionId)
);
GO

CREATE TABLE security.UserRoles (
  TenantId UNIQUEIDENTIFIER NOT NULL,
  UserId UNIQUEIDENTIFIER NOT NULL,
  RoleId UNIQUEIDENTIFIER NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_security_UserRoles_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_security_UserRoles PRIMARY KEY (TenantId, UserId, RoleId),
  CONSTRAINT FK_security_UserRoles_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
  CONSTRAINT FK_security_UserRoles_Users FOREIGN KEY (UserId) REFERENCES security.Users (UserId),
  CONSTRAINT FK_security_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES security.Roles (RoleId)
);
GO

CREATE TABLE security.Sessions (
  SessionId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_security_Sessions_SessionId DEFAULT NEWID(),
  TenantId UNIQUEIDENTIFIER NOT NULL,
  UserId UNIQUEIDENTIFIER NOT NULL,
  CompanyId UNIQUEIDENTIFIER NULL,
  JwtId UNIQUEIDENTIFIER NULL,
  ExpiresAt DATETIME2(0) NOT NULL,
  RevokedAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_security_Sessions_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_security_Sessions PRIMARY KEY (SessionId),
  CONSTRAINT FK_security_Sessions_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
  CONSTRAINT FK_security_Sessions_Users FOREIGN KEY (UserId) REFERENCES security.Users (UserId),
  CONSTRAINT FK_security_Sessions_Companies FOREIGN KEY (CompanyId) REFERENCES core.Companies (CompanyId)
);
GO

CREATE TABLE fiscal.CompanyFiscalSettings (
  CompanyFiscalSettingsId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_fiscal_CompanyFiscalSettings_Id DEFAULT NEWID(),
  TenantId UNIQUEIDENTIFIER NOT NULL,
  CompanyId UNIQUEIDENTIFIER NOT NULL,
  TaxId NVARCHAR(32) NOT NULL,
  FiscalName NVARCHAR(250) NOT NULL,
  IsElectronicInvoicingEnabled BIT NOT NULL CONSTRAINT DF_fiscal_CompanyFiscalSettings_ECF DEFAULT 0,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_fiscal_CompanyFiscalSettings_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NULL,
  CONSTRAINT PK_fiscal_CompanyFiscalSettings PRIMARY KEY (CompanyFiscalSettingsId),
  CONSTRAINT FK_fiscal_CompanyFiscalSettings_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
  CONSTRAINT FK_fiscal_CompanyFiscalSettings_Companies FOREIGN KEY (CompanyId) REFERENCES core.Companies (CompanyId),
  CONSTRAINT UQ_fiscal_CompanyFiscalSettings_Company UNIQUE (TenantId, CompanyId)
);
GO

CREATE TABLE audit.AuditLogs (
  AuditLogId BIGINT IDENTITY(1,1) NOT NULL,
  TenantId UNIQUEIDENTIFIER NULL,
  CompanyId UNIQUEIDENTIFIER NULL,
  UserId UNIQUEIDENTIFIER NULL,
  Method NVARCHAR(16) NOT NULL,
  Path NVARCHAR(512) NOT NULL,
  StatusCode INT NOT NULL,
  IpAddress NVARCHAR(64) NULL,
  UserAgent NVARCHAR(512) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_audit_AuditLogs_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_audit_AuditLogs PRIMARY KEY (AuditLogId)
);
GO

CREATE INDEX IX_core_Companies_Tenant ON core.Companies (TenantId, IsActive);
CREATE INDEX IX_core_Branches_Company ON core.Branches (TenantId, CompanyId, IsActive);
CREATE INDEX IX_security_Users_Tenant_Email ON security.Users (TenantId, Email, IsActive);
CREATE INDEX IX_security_UserCompanyAccess_User ON security.UserCompanyAccess (TenantId, UserId);
CREATE INDEX IX_security_Sessions_User ON security.Sessions (TenantId, UserId, ExpiresAt DESC);
CREATE INDEX IX_audit_AuditLogs_Tenant_CreatedAt ON audit.AuditLogs (TenantId, CreatedAt DESC);
GO
