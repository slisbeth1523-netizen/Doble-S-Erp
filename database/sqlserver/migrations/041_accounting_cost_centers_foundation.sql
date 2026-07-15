IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'accounting')
BEGIN
    EXEC('CREATE SCHEMA accounting');
END;
GO

IF OBJECT_ID('accounting.CostCenters', 'U') IS NULL
BEGIN
    CREATE TABLE accounting.CostCenters (
        CostCenterId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_accounting_CostCenters_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        Code NVARCHAR(30) NOT NULL,
        Name NVARCHAR(150) NOT NULL,
        Description NVARCHAR(500) NULL,
        ParentCostCenterId UNIQUEIDENTIFIER NULL,
        Level INT NOT NULL
            CONSTRAINT DF_accounting_CostCenters_Level DEFAULT (1),
        AllowsPosting BIT NOT NULL
            CONSTRAINT DF_accounting_CostCenters_AllowsPosting DEFAULT (1),
        ValidFrom DATE NULL,
        ValidTo DATE NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_accounting_CostCenters_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_accounting_CostCenters_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        RowVersion ROWVERSION NOT NULL,
        CONSTRAINT PK_accounting_CostCenters PRIMARY KEY (CostCenterId),
        CONSTRAINT FK_accounting_CostCenters_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_accounting_CostCenters_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_accounting_CostCenters_Parent FOREIGN KEY (ParentCostCenterId)
            REFERENCES accounting.CostCenters (CostCenterId),
        CONSTRAINT CK_accounting_CostCenters_Level CHECK (Level >= 1),
        CONSTRAINT CK_accounting_CostCenters_Dates CHECK (ValidTo IS NULL OR ValidFrom IS NULL OR ValidTo >= ValidFrom),
        CONSTRAINT CK_accounting_CostCenters_NotSelfParent CHECK (ParentCostCenterId IS NULL OR ParentCostCenterId <> CostCenterId)
    );
END;
GO

IF COL_LENGTH('accounting.CostCenters', 'Description') IS NULL
BEGIN
    ALTER TABLE accounting.CostCenters
        ADD Description NVARCHAR(500) NULL;
END;
GO

IF COL_LENGTH('accounting.CostCenters', 'ParentCostCenterId') IS NULL
BEGIN
    ALTER TABLE accounting.CostCenters
        ADD ParentCostCenterId UNIQUEIDENTIFIER NULL;
END;
GO

IF COL_LENGTH('accounting.CostCenters', 'Level') IS NULL
BEGIN
    ALTER TABLE accounting.CostCenters
        ADD Level INT NOT NULL
            CONSTRAINT DF_accounting_CostCenters_Level DEFAULT (1);
END;
GO

IF COL_LENGTH('accounting.CostCenters', 'AllowsPosting') IS NULL
BEGIN
    ALTER TABLE accounting.CostCenters
        ADD AllowsPosting BIT NOT NULL
            CONSTRAINT DF_accounting_CostCenters_AllowsPosting DEFAULT (1);
END;
GO

IF COL_LENGTH('accounting.CostCenters', 'ValidFrom') IS NULL
BEGIN
    ALTER TABLE accounting.CostCenters
        ADD ValidFrom DATE NULL;
END;
GO

IF COL_LENGTH('accounting.CostCenters', 'ValidTo') IS NULL
BEGIN
    ALTER TABLE accounting.CostCenters
        ADD ValidTo DATE NULL;
END;
GO

IF COL_LENGTH('accounting.CostCenters', 'CreatedBy') IS NULL
BEGIN
    ALTER TABLE accounting.CostCenters
        ADD CreatedBy UNIQUEIDENTIFIER NULL;
END;
GO

IF COL_LENGTH('accounting.CostCenters', 'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE accounting.CostCenters
        ADD UpdatedBy UNIQUEIDENTIFIER NULL;
END;
GO

IF COL_LENGTH('accounting.CostCenters', 'RowVersion') IS NULL
BEGIN
    ALTER TABLE accounting.CostCenters
        ADD RowVersion ROWVERSION NOT NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID('accounting.CostCenters')
      AND name = 'FK_accounting_CostCenters_Parent'
)
BEGIN
    ALTER TABLE accounting.CostCenters
        ADD CONSTRAINT FK_accounting_CostCenters_Parent FOREIGN KEY (ParentCostCenterId)
            REFERENCES accounting.CostCenters (CostCenterId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('accounting.CostCenters')
      AND name = 'CK_accounting_CostCenters_Level'
)
BEGIN
    ALTER TABLE accounting.CostCenters
        ADD CONSTRAINT CK_accounting_CostCenters_Level CHECK (Level >= 1);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('accounting.CostCenters')
      AND name = 'CK_accounting_CostCenters_Dates'
)
BEGIN
    ALTER TABLE accounting.CostCenters
        ADD CONSTRAINT CK_accounting_CostCenters_Dates CHECK (ValidTo IS NULL OR ValidFrom IS NULL OR ValidTo >= ValidFrom);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('accounting.CostCenters')
      AND name = 'CK_accounting_CostCenters_NotSelfParent'
)
BEGIN
    ALTER TABLE accounting.CostCenters
        ADD CONSTRAINT CK_accounting_CostCenters_NotSelfParent CHECK (ParentCostCenterId IS NULL OR ParentCostCenterId <> CostCenterId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('accounting.CostCenters')
      AND name = 'UX_accounting_CostCenters_Tenant_Company_Code'
)
BEGIN
    CREATE UNIQUE INDEX UX_accounting_CostCenters_Tenant_Company_Code
        ON accounting.CostCenters (TenantId, CompanyId, Code);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('accounting.CostCenters')
      AND name = 'IX_accounting_CostCenters_Parent'
)
BEGIN
    CREATE INDEX IX_accounting_CostCenters_Parent
        ON accounting.CostCenters (TenantId, CompanyId, ParentCostCenterId, IsActive);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('accounting.CostCenters')
      AND name = 'IX_accounting_CostCenters_Posting'
)
BEGIN
    CREATE INDEX IX_accounting_CostCenters_Posting
        ON accounting.CostCenters (TenantId, CompanyId, AllowsPosting, IsActive, ValidFrom, ValidTo);
END;
GO
