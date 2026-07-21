IF SCHEMA_ID('accounting') IS NULL
BEGIN
    EXEC('CREATE SCHEMA accounting');
END;
GO

IF OBJECT_ID('accounting.PostingRules', 'U') IS NULL
BEGIN
    CREATE TABLE accounting.PostingRules (
        PostingRuleId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_accounting_PostingRules_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        RuleCode NVARCHAR(80) NOT NULL,
        Name NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500) NULL,
        SourceModule NVARCHAR(40) NOT NULL,
        SourceDocumentType NVARCHAR(40) NOT NULL,
        Direction NVARCHAR(20) NOT NULL,
        DebitAccountId UNIQUEIDENTIFIER NOT NULL,
        CreditAccountId UNIQUEIDENTIFIER NOT NULL,
        TaxAccountId UNIQUEIDENTIFIER NULL,
        CostCenterId UNIQUEIDENTIFIER NULL,
        AppliesTax BIT NOT NULL CONSTRAINT DF_accounting_PostingRules_AppliesTax DEFAULT (1),
        Priority INT NOT NULL CONSTRAINT DF_accounting_PostingRules_Priority DEFAULT (100),
        IsDefault BIT NOT NULL CONSTRAINT DF_accounting_PostingRules_IsDefault DEFAULT (0),
        ValidFrom DATE NULL,
        ValidTo DATE NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_accounting_PostingRules_IsActive DEFAULT (1),
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_accounting_PostingRules_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        RowVersion ROWVERSION,
        CONSTRAINT PK_accounting_PostingRules PRIMARY KEY (PostingRuleId),
        CONSTRAINT FK_accounting_PostingRules_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_accounting_PostingRules_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_accounting_PostingRules_DebitAccount FOREIGN KEY (DebitAccountId)
            REFERENCES accounting.Accounts (AccountId),
        CONSTRAINT FK_accounting_PostingRules_CreditAccount FOREIGN KEY (CreditAccountId)
            REFERENCES accounting.Accounts (AccountId),
        CONSTRAINT FK_accounting_PostingRules_TaxAccount FOREIGN KEY (TaxAccountId)
            REFERENCES accounting.Accounts (AccountId),
        CONSTRAINT FK_accounting_PostingRules_CostCenter FOREIGN KEY (CostCenterId)
            REFERENCES accounting.CostCenters (CostCenterId),
        CONSTRAINT CK_accounting_PostingRules_Direction CHECK (Direction IN (N'RECEIVABLE', N'PAYABLE')),
        CONSTRAINT CK_accounting_PostingRules_DifferentSides CHECK (DebitAccountId <> CreditAccountId),
        CONSTRAINT CK_accounting_PostingRules_Priority CHECK (Priority BETWEEN 1 AND 9999),
        CONSTRAINT CK_accounting_PostingRules_ValidRange CHECK (ValidTo IS NULL OR ValidFrom IS NULL OR ValidTo >= ValidFrom)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('accounting.PostingRules')
      AND name = 'UX_accounting_PostingRules_Code'
)
BEGIN
    CREATE UNIQUE INDEX UX_accounting_PostingRules_Code
        ON accounting.PostingRules (TenantId, CompanyId, RuleCode);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('accounting.PostingRules')
      AND name = 'IX_accounting_PostingRules_Resolve'
)
BEGIN
    CREATE INDEX IX_accounting_PostingRules_Resolve
        ON accounting.PostingRules (
            TenantId,
            CompanyId,
            SourceModule,
            SourceDocumentType,
            Direction,
            IsActive,
            Priority,
            IsDefault
        );
END;
GO

CREATE OR ALTER VIEW accounting.V_PostingRuleSummary
AS
SELECT
    postingRule.PostingRuleId AS postingRuleId,
    postingRule.TenantId AS tenantId,
    postingRule.CompanyId AS companyId,
    postingRule.RuleCode AS ruleCode,
    postingRule.Name AS name,
    postingRule.Description AS description,
    postingRule.SourceModule AS sourceModule,
    postingRule.SourceDocumentType AS sourceDocumentType,
    postingRule.Direction AS direction,
    postingRule.DebitAccountId AS debitAccountId,
    debit.Code AS debitAccountCode,
    debit.Name AS debitAccountName,
    postingRule.CreditAccountId AS creditAccountId,
    credit.Code AS creditAccountCode,
    credit.Name AS creditAccountName,
    postingRule.TaxAccountId AS taxAccountId,
    tax.Code AS taxAccountCode,
    tax.Name AS taxAccountName,
    postingRule.CostCenterId AS costCenterId,
    costCenter.Code AS costCenterCode,
    costCenter.Name AS costCenterName,
    postingRule.AppliesTax AS appliesTax,
    postingRule.Priority AS priority,
    postingRule.IsDefault AS isDefault,
    postingRule.ValidFrom AS validFrom,
    postingRule.ValidTo AS validTo,
    postingRule.IsActive AS isActive,
    postingRule.CreatedAt AS createdAt,
    postingRule.UpdatedAt AS updatedAt,
    postingRule.CreatedBy AS createdBy,
    postingRule.UpdatedBy AS updatedBy
FROM accounting.PostingRules postingRule
INNER JOIN accounting.Accounts debit
    ON debit.AccountId = postingRule.DebitAccountId
INNER JOIN accounting.Accounts credit
    ON credit.AccountId = postingRule.CreditAccountId
LEFT JOIN accounting.Accounts tax
    ON tax.AccountId = postingRule.TaxAccountId
LEFT JOIN accounting.CostCenters costCenter
    ON costCenter.CostCenterId = postingRule.CostCenterId;
GO
