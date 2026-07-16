IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'accounting')
BEGIN
    EXEC('CREATE SCHEMA accounting');
END;
GO

IF OBJECT_ID('accounting.JournalEntries', 'U') IS NULL
BEGIN
    CREATE TABLE accounting.JournalEntries (
        JournalEntryId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_accounting_JournalEntries_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        EntryNumber NVARCHAR(40) NOT NULL,
        AccountingPeriodId UNIQUEIDENTIFIER NOT NULL,
        EntryDate DATE NOT NULL,
        Description NVARCHAR(500) NOT NULL,
        Reference NVARCHAR(120) NULL,
        SourceModule NVARCHAR(40) NOT NULL CONSTRAINT DF_accounting_JournalEntries_SourceModule DEFAULT N'MANUAL',
        SourceDocumentType NVARCHAR(50) NULL,
        SourceDocumentId UNIQUEIDENTIFIER NULL,
        Status NVARCHAR(20) NOT NULL CONSTRAINT DF_accounting_JournalEntries_Status DEFAULT N'DRAFT',
        CurrencyCode NVARCHAR(3) NOT NULL,
        ExchangeRate DECIMAL(18,6) NOT NULL CONSTRAINT DF_accounting_JournalEntries_ExchangeRate DEFAULT (1),
        TotalDebit DECIMAL(18,4) NOT NULL CONSTRAINT DF_accounting_JournalEntries_TotalDebit DEFAULT (0),
        TotalCredit DECIMAL(18,4) NOT NULL CONSTRAINT DF_accounting_JournalEntries_TotalCredit DEFAULT (0),
        TotalDebitBase DECIMAL(18,4) NOT NULL CONSTRAINT DF_accounting_JournalEntries_TotalDebitBase DEFAULT (0),
        TotalCreditBase DECIMAL(18,4) NOT NULL CONSTRAINT DF_accounting_JournalEntries_TotalCreditBase DEFAULT (0),
        PostedAt DATETIME2(7) NULL,
        PostedBy UNIQUEIDENTIFIER NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_accounting_JournalEntries_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_accounting_JournalEntries_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        RowVersion ROWVERSION NOT NULL,
        CONSTRAINT PK_accounting_JournalEntries PRIMARY KEY (JournalEntryId)
    );
END;
GO

IF COL_LENGTH('accounting.JournalEntries', 'EntryNumber') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntries ADD EntryNumber NVARCHAR(40) NULL');
IF COL_LENGTH('accounting.JournalEntries', 'AccountingPeriodId') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntries ADD AccountingPeriodId UNIQUEIDENTIFIER NULL');
IF COL_LENGTH('accounting.JournalEntries', 'SourceDocumentType') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntries ADD SourceDocumentType NVARCHAR(50) NULL');
IF COL_LENGTH('accounting.JournalEntries', 'CurrencyCode') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntries ADD CurrencyCode NVARCHAR(3) NOT NULL CONSTRAINT DF_accounting_JournalEntries_CurrencyCode DEFAULT N''DOP'' WITH VALUES');
IF COL_LENGTH('accounting.JournalEntries', 'ExchangeRate') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntries ADD ExchangeRate DECIMAL(18,6) NOT NULL CONSTRAINT DF_accounting_JournalEntries_ExchangeRate DEFAULT (1) WITH VALUES');
IF COL_LENGTH('accounting.JournalEntries', 'TotalDebit') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntries ADD TotalDebit DECIMAL(18,4) NOT NULL CONSTRAINT DF_accounting_JournalEntries_TotalDebit DEFAULT (0) WITH VALUES');
IF COL_LENGTH('accounting.JournalEntries', 'TotalCredit') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntries ADD TotalCredit DECIMAL(18,4) NOT NULL CONSTRAINT DF_accounting_JournalEntries_TotalCredit DEFAULT (0) WITH VALUES');
IF COL_LENGTH('accounting.JournalEntries', 'TotalDebitBase') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntries ADD TotalDebitBase DECIMAL(18,4) NOT NULL CONSTRAINT DF_accounting_JournalEntries_TotalDebitBase DEFAULT (0) WITH VALUES');
IF COL_LENGTH('accounting.JournalEntries', 'TotalCreditBase') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntries ADD TotalCreditBase DECIMAL(18,4) NOT NULL CONSTRAINT DF_accounting_JournalEntries_TotalCreditBase DEFAULT (0) WITH VALUES');
IF COL_LENGTH('accounting.JournalEntries', 'IsActive') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntries ADD IsActive BIT NOT NULL CONSTRAINT DF_accounting_JournalEntries_IsActive DEFAULT (1) WITH VALUES');
IF COL_LENGTH('accounting.JournalEntries', 'UpdatedAt') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntries ADD UpdatedAt DATETIME2(7) NULL');
IF COL_LENGTH('accounting.JournalEntries', 'CreatedBy') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntries ADD CreatedBy UNIQUEIDENTIFIER NULL');
IF COL_LENGTH('accounting.JournalEntries', 'UpdatedBy') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntries ADD UpdatedBy UNIQUEIDENTIFIER NULL');
IF COL_LENGTH('accounting.JournalEntries', 'RowVersion') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntries ADD RowVersion ROWVERSION NOT NULL');
GO

IF COL_LENGTH('accounting.JournalEntries', 'JournalNumber') IS NOT NULL
BEGIN
    EXEC(N'UPDATE accounting.JournalEntries SET EntryNumber = JournalNumber WHERE EntryNumber IS NULL AND JournalNumber IS NOT NULL');
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('accounting.JournalEntries') AND name = 'JournalNumber' AND is_nullable = 0)
        EXEC(N'ALTER TABLE accounting.JournalEntries ALTER COLUMN JournalNumber NVARCHAR(40) NULL');
END;
GO

EXEC(N'UPDATE accounting.JournalEntries SET Description = N''Asiento contable residual'' WHERE Description IS NULL OR LTRIM(RTRIM(Description)) = N''''');
EXEC(N'UPDATE accounting.JournalEntries SET SourceModule = N''MANUAL'' WHERE SourceModule IS NULL OR LTRIM(RTRIM(SourceModule)) = N''''');
EXEC(N'UPDATE accounting.JournalEntries SET Status = N''DRAFT'' WHERE Status IS NULL OR Status NOT IN (N''DRAFT'', N''POSTED'')');
EXEC(N'UPDATE accounting.JournalEntries SET EntryNumber = CONCAT(N''ASI-RES-'', RIGHT(CONVERT(NVARCHAR(36), JournalEntryId), 12)) WHERE EntryNumber IS NULL');
GO

IF EXISTS (SELECT 1 FROM accounting.JournalEntries WHERE EntryNumber IS NULL OR AccountingPeriodId IS NULL OR Description IS NULL)
BEGIN
    THROW 51044, 'accounting.JournalEntries residual rows cannot be adapted safely because required values are missing.', 1;
END;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('accounting.JournalEntries') AND name = 'EntryNumber' AND is_nullable = 1)
    EXEC(N'ALTER TABLE accounting.JournalEntries ALTER COLUMN EntryNumber NVARCHAR(40) NOT NULL');
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('accounting.JournalEntries') AND name = 'AccountingPeriodId' AND is_nullable = 1)
    EXEC(N'ALTER TABLE accounting.JournalEntries ALTER COLUMN AccountingPeriodId UNIQUEIDENTIFIER NOT NULL');
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('accounting.JournalEntries') AND name = 'Description' AND is_nullable = 1)
    EXEC(N'ALTER TABLE accounting.JournalEntries ALTER COLUMN Description NVARCHAR(500) NOT NULL');
GO

IF OBJECT_ID('accounting.JournalEntryLines', 'U') IS NULL
BEGIN
    CREATE TABLE accounting.JournalEntryLines (
        JournalEntryLineId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_accounting_JournalEntryLines_Id DEFAULT NEWSEQUENTIALID(),
        JournalEntryId UNIQUEIDENTIFIER NOT NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        LineNumber INT NOT NULL,
        AccountId UNIQUEIDENTIFIER NOT NULL,
        AccountCodeSnapshot NVARCHAR(50) NOT NULL,
        AccountNameSnapshot NVARCHAR(200) NOT NULL,
        CostCenterId UNIQUEIDENTIFIER NULL,
        Description NVARCHAR(500) NOT NULL,
        DebitAmount DECIMAL(18,4) NOT NULL CONSTRAINT DF_accounting_JournalEntryLines_DebitAmount DEFAULT (0),
        CreditAmount DECIMAL(18,4) NOT NULL CONSTRAINT DF_accounting_JournalEntryLines_CreditAmount DEFAULT (0),
        CurrencyCode NVARCHAR(3) NOT NULL,
        ExchangeRate DECIMAL(18,6) NOT NULL,
        DebitBaseAmount DECIMAL(18,4) NOT NULL CONSTRAINT DF_accounting_JournalEntryLines_DebitBase DEFAULT (0),
        CreditBaseAmount DECIMAL(18,4) NOT NULL CONSTRAINT DF_accounting_JournalEntryLines_CreditBase DEFAULT (0),
        Reference NVARCHAR(120) NULL,
        CreatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_accounting_JournalEntryLines_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        RowVersion ROWVERSION NOT NULL,
        CONSTRAINT PK_accounting_JournalEntryLines PRIMARY KEY (JournalEntryLineId)
    );
END;
GO

IF COL_LENGTH('accounting.JournalEntryLines', 'CompanyId') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntryLines ADD CompanyId UNIQUEIDENTIFIER NULL');
IF COL_LENGTH('accounting.JournalEntryLines', 'LineNumber') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntryLines ADD LineNumber INT NULL');
IF COL_LENGTH('accounting.JournalEntryLines', 'AccountCodeSnapshot') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntryLines ADD AccountCodeSnapshot NVARCHAR(50) NULL');
IF COL_LENGTH('accounting.JournalEntryLines', 'AccountNameSnapshot') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntryLines ADD AccountNameSnapshot NVARCHAR(200) NULL');
IF COL_LENGTH('accounting.JournalEntryLines', 'Description') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntryLines ADD Description NVARCHAR(500) NULL');
IF COL_LENGTH('accounting.JournalEntryLines', 'CurrencyCode') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntryLines ADD CurrencyCode NVARCHAR(3) NULL');
IF COL_LENGTH('accounting.JournalEntryLines', 'ExchangeRate') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntryLines ADD ExchangeRate DECIMAL(18,6) NULL');
IF COL_LENGTH('accounting.JournalEntryLines', 'DebitBaseAmount') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntryLines ADD DebitBaseAmount DECIMAL(18,4) NOT NULL CONSTRAINT DF_accounting_JournalEntryLines_DebitBase DEFAULT (0) WITH VALUES');
IF COL_LENGTH('accounting.JournalEntryLines', 'CreditBaseAmount') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntryLines ADD CreditBaseAmount DECIMAL(18,4) NOT NULL CONSTRAINT DF_accounting_JournalEntryLines_CreditBase DEFAULT (0) WITH VALUES');
IF COL_LENGTH('accounting.JournalEntryLines', 'Reference') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntryLines ADD Reference NVARCHAR(120) NULL');
IF COL_LENGTH('accounting.JournalEntryLines', 'UpdatedAt') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntryLines ADD UpdatedAt DATETIME2(7) NULL');
IF COL_LENGTH('accounting.JournalEntryLines', 'CreatedBy') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntryLines ADD CreatedBy UNIQUEIDENTIFIER NULL');
IF COL_LENGTH('accounting.JournalEntryLines', 'UpdatedBy') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntryLines ADD UpdatedBy UNIQUEIDENTIFIER NULL');
IF COL_LENGTH('accounting.JournalEntryLines', 'RowVersion') IS NULL EXEC(N'ALTER TABLE accounting.JournalEntryLines ADD RowVersion ROWVERSION NOT NULL');
GO

EXEC(N'
UPDATE line
SET CompanyId = header.CompanyId
FROM accounting.JournalEntryLines line
INNER JOIN accounting.JournalEntries header ON header.JournalEntryId = line.JournalEntryId
WHERE line.CompanyId IS NULL;

WITH numbered AS (
    SELECT JournalEntryLineId, ROW_NUMBER() OVER (PARTITION BY JournalEntryId ORDER BY CreatedAt, JournalEntryLineId) AS rn
    FROM accounting.JournalEntryLines
    WHERE LineNumber IS NULL
)
UPDATE line SET LineNumber = numbered.rn
FROM accounting.JournalEntryLines line
INNER JOIN numbered ON numbered.JournalEntryLineId = line.JournalEntryLineId;

UPDATE line
SET
    AccountCodeSnapshot = COALESCE(line.AccountCodeSnapshot, account.Code),
    AccountNameSnapshot = COALESCE(line.AccountNameSnapshot, account.Name),
    Description = COALESCE(line.Description, line.LineDescription, account.Name),
    CurrencyCode = COALESCE(line.CurrencyCode, header.CurrencyCode),
    ExchangeRate = COALESCE(line.ExchangeRate, header.ExchangeRate),
    DebitBaseAmount = ROUND(line.DebitAmount * COALESCE(line.ExchangeRate, header.ExchangeRate, 1), 4),
    CreditBaseAmount = ROUND(line.CreditAmount * COALESCE(line.ExchangeRate, header.ExchangeRate, 1), 4)
FROM accounting.JournalEntryLines line
INNER JOIN accounting.JournalEntries header ON header.JournalEntryId = line.JournalEntryId
INNER JOIN accounting.Accounts account ON account.AccountId = line.AccountId;
');
GO

IF EXISTS (
    SELECT 1
    FROM accounting.JournalEntryLines
    WHERE CompanyId IS NULL OR LineNumber IS NULL OR AccountCodeSnapshot IS NULL OR AccountNameSnapshot IS NULL
       OR Description IS NULL OR CurrencyCode IS NULL OR ExchangeRate IS NULL
)
BEGIN
    THROW 51045, 'accounting.JournalEntryLines residual rows cannot be adapted safely because required values are missing.', 1;
END;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('accounting.JournalEntryLines') AND name = 'CompanyId' AND is_nullable = 1)
    EXEC(N'ALTER TABLE accounting.JournalEntryLines ALTER COLUMN CompanyId UNIQUEIDENTIFIER NOT NULL');
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('accounting.JournalEntryLines') AND name = 'LineNumber' AND is_nullable = 1)
    EXEC(N'ALTER TABLE accounting.JournalEntryLines ALTER COLUMN LineNumber INT NOT NULL');
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('accounting.JournalEntryLines') AND name = 'AccountCodeSnapshot' AND is_nullable = 1)
    EXEC(N'ALTER TABLE accounting.JournalEntryLines ALTER COLUMN AccountCodeSnapshot NVARCHAR(50) NOT NULL');
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('accounting.JournalEntryLines') AND name = 'AccountNameSnapshot' AND is_nullable = 1)
    EXEC(N'ALTER TABLE accounting.JournalEntryLines ALTER COLUMN AccountNameSnapshot NVARCHAR(200) NOT NULL');
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('accounting.JournalEntryLines') AND name = 'Description' AND is_nullable = 1)
    EXEC(N'ALTER TABLE accounting.JournalEntryLines ALTER COLUMN Description NVARCHAR(500) NOT NULL');
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('accounting.JournalEntryLines') AND name = 'CurrencyCode' AND is_nullable = 1)
    EXEC(N'ALTER TABLE accounting.JournalEntryLines ALTER COLUMN CurrencyCode NVARCHAR(3) NOT NULL');
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('accounting.JournalEntryLines') AND name = 'ExchangeRate' AND is_nullable = 1)
    EXEC(N'ALTER TABLE accounting.JournalEntryLines ALTER COLUMN ExchangeRate DECIMAL(18,6) NOT NULL');
GO

IF OBJECT_ID('accounting.JournalEntryOperations', 'U') IS NULL
BEGIN
    CREATE TABLE accounting.JournalEntryOperations (
        JournalEntryOperationId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_accounting_JournalEntryOperations_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        JournalEntryId UNIQUEIDENTIFIER NOT NULL,
        OperationType NVARCHAR(20) NOT NULL,
        IdempotencyKey NVARCHAR(120) NOT NULL,
        RequestHash NVARCHAR(128) NOT NULL,
        ResultStatus NVARCHAR(20) NOT NULL,
        ResultTotalDebit DECIMAL(18,4) NOT NULL,
        ResultTotalCredit DECIMAL(18,4) NOT NULL,
        CreatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_accounting_JournalEntryOperations_CreatedAt DEFAULT SYSUTCDATETIME(),
        CreatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_accounting_JournalEntryOperations PRIMARY KEY (JournalEntryOperationId)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('accounting.JournalEntries') AND name = 'FK_accounting_JournalEntries_Tenants')
    ALTER TABLE accounting.JournalEntries ADD CONSTRAINT FK_accounting_JournalEntries_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('accounting.JournalEntries') AND name = 'FK_accounting_JournalEntries_Companies')
    ALTER TABLE accounting.JournalEntries ADD CONSTRAINT FK_accounting_JournalEntries_Companies FOREIGN KEY (CompanyId) REFERENCES core.Companies (CompanyId);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('accounting.JournalEntries') AND name = 'FK_accounting_JournalEntries_Periods')
    ALTER TABLE accounting.JournalEntries ADD CONSTRAINT FK_accounting_JournalEntries_Periods FOREIGN KEY (AccountingPeriodId) REFERENCES accounting.AccountingPeriods (AccountingPeriodId);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('accounting.JournalEntryLines') AND name = 'FK_accounting_JournalEntryLines_Entries')
    ALTER TABLE accounting.JournalEntryLines ADD CONSTRAINT FK_accounting_JournalEntryLines_Entries FOREIGN KEY (JournalEntryId) REFERENCES accounting.JournalEntries (JournalEntryId);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('accounting.JournalEntryLines') AND name = 'FK_accounting_JournalEntryLines_Accounts')
    ALTER TABLE accounting.JournalEntryLines ADD CONSTRAINT FK_accounting_JournalEntryLines_Accounts FOREIGN KEY (AccountId) REFERENCES accounting.Accounts (AccountId);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('accounting.JournalEntryLines') AND name = 'FK_accounting_JournalEntryLines_CostCenters')
    ALTER TABLE accounting.JournalEntryLines ADD CONSTRAINT FK_accounting_JournalEntryLines_CostCenters FOREIGN KEY (CostCenterId) REFERENCES accounting.CostCenters (CostCenterId);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('accounting.JournalEntryOperations') AND name = 'FK_accounting_JournalEntryOperations_Entries')
    ALTER TABLE accounting.JournalEntryOperations ADD CONSTRAINT FK_accounting_JournalEntryOperations_Entries FOREIGN KEY (JournalEntryId) REFERENCES accounting.JournalEntries (JournalEntryId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('accounting.JournalEntries') AND name = 'CK_accounting_JournalEntries_Status')
    ALTER TABLE accounting.JournalEntries ADD CONSTRAINT CK_accounting_JournalEntries_Status CHECK (Status IN (N'DRAFT', N'POSTED'));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('accounting.JournalEntries') AND name = 'CK_accounting_JournalEntries_ExchangeRate')
    ALTER TABLE accounting.JournalEntries ADD CONSTRAINT CK_accounting_JournalEntries_ExchangeRate CHECK (ExchangeRate > 0);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('accounting.JournalEntries') AND name = 'CK_accounting_JournalEntries_CurrencyCode')
    ALTER TABLE accounting.JournalEntries ADD CONSTRAINT CK_accounting_JournalEntries_CurrencyCode CHECK (LEN(CurrencyCode) = 3);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('accounting.JournalEntryLines') AND name = 'CK_accounting_JournalEntryLines_Amounts')
    ALTER TABLE accounting.JournalEntryLines ADD CONSTRAINT CK_accounting_JournalEntryLines_Amounts CHECK (DebitAmount >= 0 AND CreditAmount >= 0 AND ((DebitAmount > 0 AND CreditAmount = 0) OR (CreditAmount > 0 AND DebitAmount = 0)));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('accounting.JournalEntryLines') AND name = 'CK_accounting_JournalEntryLines_BaseAmounts')
    ALTER TABLE accounting.JournalEntryLines ADD CONSTRAINT CK_accounting_JournalEntryLines_BaseAmounts CHECK (DebitBaseAmount >= 0 AND CreditBaseAmount >= 0 AND ExchangeRate > 0 AND LEN(CurrencyCode) = 3);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('accounting.JournalEntryOperations') AND name = 'CK_accounting_JournalEntryOperations_Type')
    ALTER TABLE accounting.JournalEntryOperations ADD CONSTRAINT CK_accounting_JournalEntryOperations_Type CHECK (OperationType IN (N'POST'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('accounting.JournalEntries') AND name = 'UX_accounting_JournalEntries_Tenant_Company_Number')
    CREATE UNIQUE INDEX UX_accounting_JournalEntries_Tenant_Company_Number ON accounting.JournalEntries (TenantId, CompanyId, EntryNumber);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('accounting.JournalEntryLines') AND name = 'UX_accounting_JournalEntryLines_Entry_LineNumber')
    CREATE UNIQUE INDEX UX_accounting_JournalEntryLines_Entry_LineNumber ON accounting.JournalEntryLines (JournalEntryId, LineNumber);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('accounting.JournalEntryOperations') AND name = 'UX_accounting_JournalEntryOperations_Idempotency')
    CREATE UNIQUE INDEX UX_accounting_JournalEntryOperations_Idempotency ON accounting.JournalEntryOperations (TenantId, CompanyId, OperationType, IdempotencyKey);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('accounting.JournalEntries') AND name = 'IX_accounting_JournalEntries_Date')
    CREATE INDEX IX_accounting_JournalEntries_Date ON accounting.JournalEntries (TenantId, CompanyId, EntryDate);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('accounting.JournalEntries') AND name = 'IX_accounting_JournalEntries_Status')
    CREATE INDEX IX_accounting_JournalEntries_Status ON accounting.JournalEntries (TenantId, CompanyId, Status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('accounting.JournalEntries') AND name = 'IX_accounting_JournalEntries_Period')
    CREATE INDEX IX_accounting_JournalEntries_Period ON accounting.JournalEntries (TenantId, CompanyId, AccountingPeriodId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('accounting.JournalEntryLines') AND name = 'IX_accounting_JournalEntryLines_Account')
    CREATE INDEX IX_accounting_JournalEntryLines_Account ON accounting.JournalEntryLines (TenantId, CompanyId, AccountId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('accounting.JournalEntryLines') AND name = 'IX_accounting_JournalEntryLines_CostCenter')
    CREATE INDEX IX_accounting_JournalEntryLines_CostCenter ON accounting.JournalEntryLines (TenantId, CompanyId, CostCenterId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('accounting.JournalEntries') AND name = 'IX_accounting_JournalEntries_Source')
    CREATE INDEX IX_accounting_JournalEntries_Source ON accounting.JournalEntries (TenantId, CompanyId, SourceModule, SourceDocumentType, SourceDocumentId);
GO

EXEC(N'
CREATE OR ALTER VIEW accounting.V_JournalEntrySummary
AS
SELECT
    entry.JournalEntryId AS journalEntryId,
    entry.TenantId AS tenantId,
    entry.CompanyId AS companyId,
    entry.EntryNumber AS entryNumber,
    entry.EntryDate AS entryDate,
    entry.AccountingPeriodId AS accountingPeriodId,
    CONCAT(period.FiscalYear, N''-'', RIGHT(CONCAT(N''00'', period.PeriodNumber), 2)) AS periodCode,
    entry.Description AS description,
    entry.Reference AS reference,
    entry.SourceModule AS sourceModule,
    entry.SourceDocumentType AS sourceDocumentType,
    entry.SourceDocumentId AS sourceDocumentId,
    entry.Status AS status,
    entry.CurrencyCode AS currencyCode,
    entry.ExchangeRate AS exchangeRate,
    entry.TotalDebit AS totalDebit,
    entry.TotalCredit AS totalCredit,
    entry.TotalDebitBase AS totalDebitBase,
    entry.TotalCreditBase AS totalCreditBase,
    entry.TotalDebit - entry.TotalCredit AS difference,
    entry.TotalDebitBase - entry.TotalCreditBase AS baseDifference,
    (SELECT COUNT(1) FROM accounting.JournalEntryLines line WHERE line.JournalEntryId = entry.JournalEntryId) AS lineCount,
    entry.PostedAt AS postedAt,
    entry.PostedBy AS postedBy,
    entry.CreatedAt AS createdAt,
    entry.CreatedBy AS createdBy,
    entry.UpdatedAt AS updatedAt,
    entry.UpdatedBy AS updatedBy
FROM accounting.JournalEntries entry
INNER JOIN accounting.AccountingPeriods period ON period.AccountingPeriodId = entry.AccountingPeriodId;
');
GO

EXEC(N'
CREATE OR ALTER VIEW accounting.V_JournalEntryLineSummary
AS
SELECT
    line.JournalEntryLineId AS journalEntryLineId,
    line.JournalEntryId AS journalEntryId,
    line.TenantId AS tenantId,
    line.CompanyId AS companyId,
    entry.EntryNumber AS entryNumber,
    line.LineNumber AS lineNumber,
    line.AccountId AS accountId,
    line.AccountCodeSnapshot AS accountCode,
    line.AccountNameSnapshot AS accountName,
    line.CostCenterId AS costCenterId,
    cost.Code AS costCenterCode,
    cost.Name AS costCenterName,
    line.Description AS description,
    line.DebitAmount AS debitAmount,
    line.CreditAmount AS creditAmount,
    line.CurrencyCode AS currencyCode,
    line.ExchangeRate AS exchangeRate,
    line.DebitBaseAmount AS debitBaseAmount,
    line.CreditBaseAmount AS creditBaseAmount,
    line.Reference AS reference,
    line.CreatedAt AS createdAt,
    line.CreatedBy AS createdBy,
    line.UpdatedAt AS updatedAt,
    line.UpdatedBy AS updatedBy,
    CAST(1 AS BIT) AS isActive
FROM accounting.JournalEntryLines line
INNER JOIN accounting.JournalEntries entry ON entry.JournalEntryId = line.JournalEntryId
LEFT JOIN accounting.CostCenters cost ON cost.CostCenterId = line.CostCenterId;
');
GO
