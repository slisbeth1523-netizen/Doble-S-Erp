DECLARE @TenantName NVARCHAR(200);
DECLARE @TenantSlug NVARCHAR(120);
DECLARE @CompanyLegalName NVARCHAR(250);
DECLARE @CompanyTradeName NVARCHAR(250);
DECLARE @CompanyTaxId NVARCHAR(32);
DECLARE @AdminEmail NVARCHAR(256);
DECLARE @AdminDisplayName NVARCHAR(200);
DECLARE @AdminPasswordHash NVARCHAR(255);

-- Complete these values before running this template.
-- Do not commit real passwords or password hashes into source control.
-- SET @TenantName = N'';
-- SET @TenantSlug = N'';
-- SET @CompanyLegalName = N'';
-- SET @CompanyTradeName = NULL;
-- SET @CompanyTaxId = NULL;
-- SET @AdminEmail = N'';
-- SET @AdminDisplayName = N'';
-- SET @AdminPasswordHash = N'';

IF @TenantName IS NULL
   OR @TenantSlug IS NULL
   OR @CompanyLegalName IS NULL
   OR @AdminEmail IS NULL
   OR @AdminDisplayName IS NULL
   OR @AdminPasswordHash IS NULL
BEGIN
  THROW 50000, 'Complete all required onboarding variables before running this script.', 1;
END;

BEGIN TRANSACTION;

DECLARE @TenantId UNIQUEIDENTIFIER = NEWID();
DECLARE @CompanyId UNIQUEIDENTIFIER = NEWID();
DECLARE @AdminUserId UNIQUEIDENTIFIER = NEWID();
DECLARE @AdminRoleId UNIQUEIDENTIFIER = NEWID();

INSERT INTO core.Tenants (
  TenantId,
  Name,
  Slug
)
VALUES (
  @TenantId,
  @TenantName,
  @TenantSlug
);

INSERT INTO core.Companies (
  CompanyId,
  TenantId,
  LegalName,
  TradeName,
  TaxId
)
VALUES (
  @CompanyId,
  @TenantId,
  @CompanyLegalName,
  @CompanyTradeName,
  @CompanyTaxId
);

INSERT INTO security.Users (
  UserId,
  TenantId,
  DefaultCompanyId,
  Email,
  DisplayName,
  PasswordHash
)
VALUES (
  @AdminUserId,
  @TenantId,
  @CompanyId,
  @AdminEmail,
  @AdminDisplayName,
  @AdminPasswordHash
);

INSERT INTO security.UserCompanyAccess (
  TenantId,
  UserId,
  CompanyId,
  IsDefault
)
VALUES (
  @TenantId,
  @AdminUserId,
  @CompanyId,
  1
);

INSERT INTO security.Roles (
  RoleId,
  TenantId,
  Code,
  Name,
  IsSystemRole
)
VALUES (
  @AdminRoleId,
  @TenantId,
  N'ADMIN',
  N'Administrador',
  1
);

INSERT INTO security.UserRoles (
  TenantId,
  UserId,
  RoleId
)
VALUES (
  @TenantId,
  @AdminUserId,
  @AdminRoleId
);

COMMIT TRANSACTION;

SELECT
  @TenantId AS TenantId,
  @CompanyId AS CompanyId,
  @AdminUserId AS AdminUserId,
  @AdminRoleId AS AdminRoleId;

