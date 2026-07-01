IF COL_LENGTH('security.Permissions', 'IsActive') IS NULL
BEGIN
  ALTER TABLE security.Permissions
    ADD IsActive BIT NOT NULL CONSTRAINT DF_security_Permissions_IsActive DEFAULT 1;
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.tables t
  INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE s.name = 'audit'
    AND t.name = 'AuditEvents'
)
BEGIN
  CREATE TABLE audit.AuditEvents (
    AuditEventId BIGINT IDENTITY(1,1) NOT NULL,
    TenantId UNIQUEIDENTIFIER NULL,
    CompanyId UNIQUEIDENTIFIER NULL,
    UserId UNIQUEIDENTIFIER NULL,
    Action NVARCHAR(120) NOT NULL,
    EntityName NVARCHAR(160) NULL,
    EntityId NVARCHAR(120) NULL,
    MetadataJson NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_audit_AuditEvents_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_audit_AuditEvents PRIMARY KEY (AuditEventId),
    CONSTRAINT CK_audit_AuditEvents_MetadataJson CHECK (MetadataJson IS NULL OR ISJSON(MetadataJson) = 1)
  );

  CREATE INDEX IX_audit_AuditEvents_Tenant_Action_CreatedAt
    ON audit.AuditEvents (TenantId, Action, CreatedAt DESC);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_security_Sessions_JwtId'
    AND object_id = OBJECT_ID('security.Sessions')
)
BEGIN
  CREATE UNIQUE INDEX IX_security_Sessions_JwtId
    ON security.Sessions (TenantId, UserId, JwtId)
    WHERE JwtId IS NOT NULL;
END;
GO

