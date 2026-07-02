IF COL_LENGTH('core.UnitsOfMeasure', 'Symbol') IS NULL
BEGIN
  ALTER TABLE core.UnitsOfMeasure
    ADD Symbol NVARCHAR(20) NULL;
END;
GO

IF COL_LENGTH('core.UnitsOfMeasure', 'UnitType') IS NULL
BEGIN
  ALTER TABLE core.UnitsOfMeasure
    ADD UnitType NVARCHAR(40) NULL;
END;
GO

IF COL_LENGTH('core.UnitsOfMeasure', 'DecimalPrecision') IS NULL
BEGIN
  ALTER TABLE core.UnitsOfMeasure
    ADD DecimalPrecision INT NOT NULL
      CONSTRAINT DF_core_UnitsOfMeasure_DecimalPrecision DEFAULT (2);
END;
GO

IF COL_LENGTH('core.UnitsOfMeasure', 'IsBaseUnit') IS NULL
BEGIN
  ALTER TABLE core.UnitsOfMeasure
    ADD IsBaseUnit BIT NOT NULL
      CONSTRAINT DF_core_UnitsOfMeasure_IsBaseUnit DEFAULT (0);
END;
GO

IF EXISTS (
  SELECT 1
  FROM sys.key_constraints
  WHERE parent_object_id = OBJECT_ID('core.UnitsOfMeasure')
    AND name = 'UQ_core_UnitsOfMeasure_Tenant_Company_Code'
)
BEGIN
  ALTER TABLE core.UnitsOfMeasure
    DROP CONSTRAINT UQ_core_UnitsOfMeasure_Tenant_Company_Code;
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('core.UnitsOfMeasure')
    AND name = 'CK_core_UnitsOfMeasure_DecimalPrecision'
)
BEGIN
  ALTER TABLE core.UnitsOfMeasure
    ADD CONSTRAINT CK_core_UnitsOfMeasure_DecimalPrecision CHECK (DecimalPrecision BETWEEN 0 AND 6);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('core.UnitsOfMeasure')
    AND name = 'UX_core_UnitsOfMeasure_Tenant_Company_Code'
)
BEGIN
  CREATE UNIQUE INDEX UX_core_UnitsOfMeasure_Tenant_Company_Code
    ON core.UnitsOfMeasure (TenantId, CompanyId, Code)
    WHERE CompanyId IS NOT NULL;
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('core.UnitsOfMeasure')
    AND name = 'UX_core_UnitsOfMeasure_Tenant_Global_Code'
)
BEGIN
  CREATE UNIQUE INDEX UX_core_UnitsOfMeasure_Tenant_Global_Code
    ON core.UnitsOfMeasure (TenantId, Code)
    WHERE CompanyId IS NULL;
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('core.UnitsOfMeasure')
    AND name = 'IX_core_UnitsOfMeasure_Tenant_Company_Name'
)
BEGIN
  CREATE INDEX IX_core_UnitsOfMeasure_Tenant_Company_Name
    ON core.UnitsOfMeasure (TenantId, CompanyId, Name);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('core.UnitsOfMeasure')
    AND name = 'IX_core_UnitsOfMeasure_Tenant_IsActive'
)
BEGIN
  CREATE INDEX IX_core_UnitsOfMeasure_Tenant_IsActive
    ON core.UnitsOfMeasure (TenantId, IsActive);
END;
GO
