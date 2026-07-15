IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'accounting')
BEGIN
    EXEC('CREATE SCHEMA accounting');
END;
GO

IF OBJECT_ID('accounting.AccountingPeriods', 'U') IS NULL
BEGIN
    CREATE TABLE accounting.AccountingPeriods (
        AccountingPeriodId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_accounting_AccountingPeriods_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        FiscalYear INT NOT NULL,
        PeriodNumber INT NOT NULL,
        Name NVARCHAR(100) NOT NULL,
        StartDate DATE NOT NULL,
        EndDate DATE NOT NULL,
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_accounting_AccountingPeriods_Status DEFAULT N'OPEN',
        IsAdjustmentPeriod BIT NOT NULL
            CONSTRAINT DF_accounting_AccountingPeriods_IsAdjustmentPeriod DEFAULT (0),
        OpenedAt DATETIME2(7) NULL,
        OpenedBy UNIQUEIDENTIFIER NULL,
        ClosedAt DATETIME2(7) NULL,
        ClosedBy UNIQUEIDENTIFIER NULL,
        ReopenedAt DATETIME2(7) NULL,
        ReopenedBy UNIQUEIDENTIFIER NULL,
        ReopenReason NVARCHAR(500) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_accounting_AccountingPeriods_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_accounting_AccountingPeriods_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        RowVersion ROWVERSION NOT NULL,
        CONSTRAINT PK_accounting_AccountingPeriods PRIMARY KEY (AccountingPeriodId),
        CONSTRAINT FK_accounting_AccountingPeriods_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_accounting_AccountingPeriods_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT CK_accounting_AccountingPeriods_Status CHECK (Status IN (N'OPEN', N'CLOSED')),
        CONSTRAINT CK_accounting_AccountingPeriods_FiscalYear CHECK (FiscalYear BETWEEN 1900 AND 2200),
        CONSTRAINT CK_accounting_AccountingPeriods_PeriodNumber CHECK (PeriodNumber > 0),
        CONSTRAINT CK_accounting_AccountingPeriods_DateRange CHECK (EndDate >= StartDate)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('accounting.AccountingPeriods')
      AND name = 'UX_accounting_AccountingPeriods_Tenant_Company_Year_Number'
)
BEGIN
    CREATE UNIQUE INDEX UX_accounting_AccountingPeriods_Tenant_Company_Year_Number
        ON accounting.AccountingPeriods (TenantId, CompanyId, FiscalYear, PeriodNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('accounting.AccountingPeriods')
      AND name = 'IX_accounting_AccountingPeriods_Status_DateRange'
)
BEGIN
    CREATE INDEX IX_accounting_AccountingPeriods_Status_DateRange
        ON accounting.AccountingPeriods (TenantId, CompanyId, Status, StartDate, EndDate);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('accounting.AccountingPeriods')
      AND name = 'IX_accounting_AccountingPeriods_Active_DateRange'
)
BEGIN
    CREATE INDEX IX_accounting_AccountingPeriods_Active_DateRange
        ON accounting.AccountingPeriods (TenantId, CompanyId, IsActive, StartDate, EndDate);
END;
GO

CREATE OR ALTER VIEW accounting.V_AccountingPeriodSummary
AS
SELECT
    period.AccountingPeriodId AS accountingPeriodId,
    period.TenantId AS tenantId,
    period.CompanyId AS companyId,
    period.FiscalYear AS fiscalYear,
    period.PeriodNumber AS periodNumber,
    period.Name AS name,
    period.StartDate AS startDate,
    period.EndDate AS endDate,
    period.Status AS status,
    period.IsAdjustmentPeriod AS isAdjustmentPeriod,
    period.OpenedAt AS openedAt,
    period.OpenedBy AS openedBy,
    period.ClosedAt AS closedAt,
    period.ClosedBy AS closedBy,
    period.ReopenedAt AS reopenedAt,
    period.ReopenedBy AS reopenedBy,
    period.ReopenReason AS reopenReason,
    period.IsActive AS isActive,
    period.CreatedAt AS createdAt,
    period.CreatedBy AS createdBy,
    period.UpdatedAt AS updatedAt,
    period.UpdatedBy AS updatedBy,
    DATEDIFF(DAY, period.StartDate, period.EndDate) + 1 AS durationDays,
    CAST(CASE
        WHEN CONVERT(DATE, SYSUTCDATETIME()) BETWEEN period.StartDate AND period.EndDate THEN 1
        ELSE 0
    END AS BIT) AS isCurrentPeriod,
    CONCAT(period.FiscalYear, N'-', RIGHT(CONCAT(N'00', period.PeriodNumber), 2)) AS displayCode
FROM accounting.AccountingPeriods period;
GO
