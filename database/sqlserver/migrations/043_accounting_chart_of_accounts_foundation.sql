IF SCHEMA_ID('accounting') IS NULL
BEGIN
    EXEC('CREATE SCHEMA accounting');
END;

IF OBJECT_ID('accounting.Accounts', 'U') IS NULL
BEGIN
    CREATE TABLE accounting.Accounts (
        AccountId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_accounting_Accounts_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        Code NVARCHAR(50) NOT NULL,
        Name NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500) NULL,
        ParentAccountId UNIQUEIDENTIFIER NULL,
        Level INT NOT NULL CONSTRAINT DF_accounting_Accounts_Level DEFAULT (1),
        AccountType NVARCHAR(30) NOT NULL,
        NormalBalance NVARCHAR(10) NOT NULL,
        Classification NVARCHAR(40) NULL,
        AllowsPosting BIT NOT NULL CONSTRAINT DF_accounting_Accounts_AllowsPosting DEFAULT (1),
        RequiresCostCenter BIT NOT NULL CONSTRAINT DF_accounting_Accounts_RequiresCostCenter DEFAULT (0),
        RequiresThirdParty BIT NOT NULL CONSTRAINT DF_accounting_Accounts_RequiresThirdParty DEFAULT (0),
        IsControlAccount BIT NOT NULL CONSTRAINT DF_accounting_Accounts_IsControlAccount DEFAULT (0),
        CurrencyCode NVARCHAR(3) NULL,
        ValidFrom DATE NULL,
        ValidTo DATE NULL,
        IsBlocked BIT NOT NULL CONSTRAINT DF_accounting_Accounts_IsBlocked DEFAULT (0),
        BlockReason NVARCHAR(500) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_accounting_Accounts_IsActive DEFAULT (1),
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_accounting_Accounts_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        RowVersion ROWVERSION,
        CONSTRAINT PK_accounting_Accounts PRIMARY KEY (AccountId)
    );
END;

IF COL_LENGTH('accounting.Accounts', 'Description') IS NULL EXEC(N'ALTER TABLE accounting.Accounts ADD Description NVARCHAR(500) NULL');
IF COL_LENGTH('accounting.Accounts', 'ParentAccountId') IS NULL EXEC(N'ALTER TABLE accounting.Accounts ADD ParentAccountId UNIQUEIDENTIFIER NULL');
IF COL_LENGTH('accounting.Accounts', 'Level') IS NULL EXEC(N'ALTER TABLE accounting.Accounts ADD Level INT NOT NULL CONSTRAINT DF_accounting_Accounts_Level DEFAULT (1) WITH VALUES');
IF COL_LENGTH('accounting.Accounts', 'Classification') IS NULL EXEC(N'ALTER TABLE accounting.Accounts ADD Classification NVARCHAR(40) NULL');
IF COL_LENGTH('accounting.Accounts', 'AllowsPosting') IS NULL EXEC(N'ALTER TABLE accounting.Accounts ADD AllowsPosting BIT NOT NULL CONSTRAINT DF_accounting_Accounts_AllowsPosting DEFAULT (1) WITH VALUES');
IF COL_LENGTH('accounting.Accounts', 'RequiresCostCenter') IS NULL EXEC(N'ALTER TABLE accounting.Accounts ADD RequiresCostCenter BIT NOT NULL CONSTRAINT DF_accounting_Accounts_RequiresCostCenter DEFAULT (0) WITH VALUES');
IF COL_LENGTH('accounting.Accounts', 'RequiresThirdParty') IS NULL EXEC(N'ALTER TABLE accounting.Accounts ADD RequiresThirdParty BIT NOT NULL CONSTRAINT DF_accounting_Accounts_RequiresThirdParty DEFAULT (0) WITH VALUES');
IF COL_LENGTH('accounting.Accounts', 'IsControlAccount') IS NULL EXEC(N'ALTER TABLE accounting.Accounts ADD IsControlAccount BIT NOT NULL CONSTRAINT DF_accounting_Accounts_IsControlAccount DEFAULT (0) WITH VALUES');
IF COL_LENGTH('accounting.Accounts', 'CurrencyCode') IS NULL EXEC(N'ALTER TABLE accounting.Accounts ADD CurrencyCode NVARCHAR(3) NULL');
IF COL_LENGTH('accounting.Accounts', 'ValidFrom') IS NULL EXEC(N'ALTER TABLE accounting.Accounts ADD ValidFrom DATE NULL');
IF COL_LENGTH('accounting.Accounts', 'ValidTo') IS NULL EXEC(N'ALTER TABLE accounting.Accounts ADD ValidTo DATE NULL');
IF COL_LENGTH('accounting.Accounts', 'IsBlocked') IS NULL EXEC(N'ALTER TABLE accounting.Accounts ADD IsBlocked BIT NOT NULL CONSTRAINT DF_accounting_Accounts_IsBlocked DEFAULT (0) WITH VALUES');
IF COL_LENGTH('accounting.Accounts', 'BlockReason') IS NULL EXEC(N'ALTER TABLE accounting.Accounts ADD BlockReason NVARCHAR(500) NULL');
IF COL_LENGTH('accounting.Accounts', 'CreatedBy') IS NULL EXEC(N'ALTER TABLE accounting.Accounts ADD CreatedBy UNIQUEIDENTIFIER NULL');
IF COL_LENGTH('accounting.Accounts', 'UpdatedBy') IS NULL EXEC(N'ALTER TABLE accounting.Accounts ADD UpdatedBy UNIQUEIDENTIFIER NULL');
IF COL_LENGTH('accounting.Accounts', 'RowVersion') IS NULL EXEC(N'ALTER TABLE accounting.Accounts ADD RowVersion ROWVERSION');

EXEC(N'UPDATE accounting.Accounts SET Level = 1 WHERE Level IS NULL OR Level < 1');
EXEC(N'UPDATE accounting.Accounts SET AllowsPosting = CASE WHEN IsControlAccount = 1 THEN 0 ELSE AllowsPosting END');
EXEC(N'UPDATE accounting.Accounts SET AccountType = UPPER(AccountType), NormalBalance = UPPER(NormalBalance)');
EXEC(N'UPDATE accounting.Accounts SET AccountType = N''ASSET'' WHERE AccountType NOT IN (N''ASSET'', N''LIABILITY'', N''EQUITY'', N''REVENUE'', N''EXPENSE'', N''COST'', N''MEMO'')');
EXEC(N'UPDATE accounting.Accounts SET NormalBalance = N''DEBIT'' WHERE NormalBalance NOT IN (N''DEBIT'', N''CREDIT'')');

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('accounting.Accounts') AND name = 'UQ_accounting_Accounts_Code')
BEGIN
    ALTER TABLE accounting.Accounts DROP CONSTRAINT UQ_accounting_Accounts_Code;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('accounting.Accounts') AND name = 'FK_accounting_Accounts_Tenants')
BEGIN
    ALTER TABLE accounting.Accounts ADD CONSTRAINT FK_accounting_Accounts_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId);
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('accounting.Accounts') AND name = 'FK_accounting_Accounts_Companies')
BEGIN
    ALTER TABLE accounting.Accounts ADD CONSTRAINT FK_accounting_Accounts_Companies FOREIGN KEY (CompanyId) REFERENCES core.Companies (CompanyId);
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('accounting.Accounts') AND name = 'FK_accounting_Accounts_Parent')
BEGIN
    ALTER TABLE accounting.Accounts ADD CONSTRAINT FK_accounting_Accounts_Parent FOREIGN KEY (ParentAccountId) REFERENCES accounting.Accounts (AccountId);
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('accounting.Accounts') AND name = 'CK_accounting_Accounts_Level')
BEGIN
    EXEC(N'ALTER TABLE accounting.Accounts ADD CONSTRAINT CK_accounting_Accounts_Level CHECK (Level >= 1)');
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('accounting.Accounts') AND name = 'CK_accounting_Accounts_NotSelfParent')
BEGIN
    EXEC(N'ALTER TABLE accounting.Accounts ADD CONSTRAINT CK_accounting_Accounts_NotSelfParent CHECK (ParentAccountId IS NULL OR ParentAccountId <> AccountId)');
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('accounting.Accounts') AND name = 'CK_accounting_Accounts_Dates')
BEGIN
    EXEC(N'ALTER TABLE accounting.Accounts ADD CONSTRAINT CK_accounting_Accounts_Dates CHECK (ValidTo IS NULL OR ValidFrom IS NULL OR ValidTo >= ValidFrom)');
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('accounting.Accounts') AND name = 'CK_accounting_Accounts_Type')
BEGIN
    EXEC(N'ALTER TABLE accounting.Accounts ADD CONSTRAINT CK_accounting_Accounts_Type CHECK (AccountType IN (N''ASSET'', N''LIABILITY'', N''EQUITY'', N''REVENUE'', N''EXPENSE'', N''COST'', N''MEMO''))');
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('accounting.Accounts') AND name = 'CK_accounting_Accounts_NormalBalance')
BEGIN
    EXEC(N'ALTER TABLE accounting.Accounts ADD CONSTRAINT CK_accounting_Accounts_NormalBalance CHECK (NormalBalance IN (N''DEBIT'', N''CREDIT''))');
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('accounting.Accounts') AND name = 'CK_accounting_Accounts_CurrencyCode')
BEGIN
    EXEC(N'ALTER TABLE accounting.Accounts ADD CONSTRAINT CK_accounting_Accounts_CurrencyCode CHECK (CurrencyCode IS NULL OR LEN(CurrencyCode) = 3)');
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('accounting.Accounts') AND name = 'UX_accounting_Accounts_Tenant_Company_Code')
BEGIN
    EXEC(N'CREATE UNIQUE INDEX UX_accounting_Accounts_Tenant_Company_Code ON accounting.Accounts (TenantId, CompanyId, Code)');
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('accounting.Accounts') AND name = 'IX_accounting_Accounts_Parent')
BEGIN
    EXEC(N'CREATE INDEX IX_accounting_Accounts_Parent ON accounting.Accounts (TenantId, CompanyId, ParentAccountId, IsActive)');
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('accounting.Accounts') AND name = 'IX_accounting_Accounts_Type')
BEGIN
    EXEC(N'CREATE INDEX IX_accounting_Accounts_Type ON accounting.Accounts (TenantId, CompanyId, AccountType, IsActive)');
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('accounting.Accounts') AND name = 'IX_accounting_Accounts_Posting')
BEGIN
    EXEC(N'CREATE INDEX IX_accounting_Accounts_Posting ON accounting.Accounts (TenantId, CompanyId, AllowsPosting, IsActive, IsBlocked)');
END;
GO

EXEC(N'
CREATE OR ALTER VIEW accounting.V_AccountSummary
AS
WITH AccountTree AS (
    SELECT
        account.AccountId,
        CAST(account.Code + N'' '' + account.Name AS NVARCHAR(MAX)) AS FullPath
    FROM accounting.Accounts account
    WHERE account.ParentAccountId IS NULL
    UNION ALL
    SELECT
        child.AccountId,
        CAST(parent.FullPath + N'' / '' + child.Code + N'' '' + child.Name AS NVARCHAR(MAX)) AS FullPath
    FROM accounting.Accounts child
    INNER JOIN AccountTree parent ON parent.AccountId = child.ParentAccountId
)
SELECT
    account.AccountId AS accountId,
    account.TenantId AS tenantId,
    account.CompanyId AS companyId,
    account.Code AS code,
    account.Name AS name,
    account.Description AS description,
    account.ParentAccountId AS parentAccountId,
    parent.Code AS parentCode,
    parent.Name AS parentName,
    account.Level AS level,
    account.AccountType AS accountType,
    account.NormalBalance AS normalBalance,
    account.Classification AS classification,
    account.AllowsPosting AS allowsPosting,
    account.RequiresCostCenter AS requiresCostCenter,
    account.RequiresThirdParty AS requiresThirdParty,
    account.IsControlAccount AS isControlAccount,
    account.CurrencyCode AS currencyCode,
    account.ValidFrom AS validFrom,
    account.ValidTo AS validTo,
    account.IsBlocked AS isBlocked,
    account.BlockReason AS blockReason,
    account.IsActive AS isActive,
    (SELECT COUNT(1) FROM accounting.Accounts child WHERE child.ParentAccountId = account.AccountId AND child.TenantId = account.TenantId AND child.CompanyId = account.CompanyId) AS childCount,
    COALESCE(tree.FullPath, account.Code + N'' '' + account.Name) AS fullPath,
    account.CreatedAt AS createdAt,
    account.UpdatedAt AS updatedAt,
    account.CreatedBy AS createdBy,
    account.UpdatedBy AS updatedBy
FROM accounting.Accounts account
LEFT JOIN accounting.Accounts parent ON parent.AccountId = account.ParentAccountId
LEFT JOIN AccountTree tree ON tree.AccountId = account.AccountId;
');
GO

EXEC(N'
CREATE OR ALTER VIEW accounting.V_PostableAccounts
AS
SELECT *
FROM accounting.V_AccountSummary
WHERE isActive = 1
  AND isBlocked = 0
  AND allowsPosting = 1;
');
