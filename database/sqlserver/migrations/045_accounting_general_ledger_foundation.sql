IF SCHEMA_ID('accounting') IS NULL
BEGIN
    EXEC('CREATE SCHEMA accounting');
END;
GO

EXEC(N'
CREATE OR ALTER VIEW accounting.V_GeneralLedgerEntries
AS
SELECT
    entry.TenantId AS tenantId,
    entry.CompanyId AS companyId,
    entry.JournalEntryId AS journalEntryId,
    line.JournalEntryLineId AS journalEntryLineId,
    entry.EntryNumber AS entryNumber,
    entry.EntryDate AS entryDate,
    entry.AccountingPeriodId AS accountingPeriodId,
    period.FiscalYear AS fiscalYear,
    period.PeriodNumber AS periodNumber,
    CONCAT(period.FiscalYear, N''-'', RIGHT(CONCAT(N''00'', period.PeriodNumber), 2)) AS periodCode,
    entry.SourceModule AS sourceModule,
    entry.SourceDocumentType AS sourceDocumentType,
    entry.SourceDocumentId AS sourceDocumentId,
    entry.Description AS headerDescription,
    entry.Reference AS headerReference,
    line.LineNumber AS lineNumber,
    line.AccountId AS accountId,
    line.AccountCodeSnapshot AS accountCode,
    line.AccountNameSnapshot AS accountName,
    account.Code AS currentAccountCode,
    account.Name AS currentAccountName,
    account.AccountType AS accountType,
    account.NormalBalance AS normalBalance,
    line.CostCenterId AS costCenterId,
    cost.Code AS costCenterCode,
    cost.Name AS costCenterName,
    line.Description AS lineDescription,
    line.Reference AS lineReference,
    line.CurrencyCode AS currencyCode,
    line.ExchangeRate AS exchangeRate,
    line.DebitAmount AS debitAmount,
    line.CreditAmount AS creditAmount,
    line.DebitBaseAmount AS debitBaseAmount,
    line.CreditBaseAmount AS creditBaseAmount,
    CASE
        WHEN account.NormalBalance = N''CREDIT'' THEN line.CreditAmount - line.DebitAmount
        ELSE line.DebitAmount - line.CreditAmount
    END AS signedAmount,
    CASE
        WHEN account.NormalBalance = N''CREDIT'' THEN line.CreditBaseAmount - line.DebitBaseAmount
        ELSE line.DebitBaseAmount - line.CreditBaseAmount
    END AS signedBaseAmount,
    entry.PostedAt AS postedAt,
    entry.PostedBy AS postedBy,
    line.CreatedAt AS createdAt,
    line.CreatedBy AS createdBy,
    line.UpdatedAt AS updatedAt,
    line.UpdatedBy AS updatedBy,
    CAST(1 AS BIT) AS isActive
FROM accounting.JournalEntryLines line
INNER JOIN accounting.JournalEntries entry ON entry.JournalEntryId = line.JournalEntryId
INNER JOIN accounting.AccountingPeriods period ON period.AccountingPeriodId = entry.AccountingPeriodId
INNER JOIN accounting.Accounts account ON account.AccountId = line.AccountId
LEFT JOIN accounting.CostCenters cost ON cost.CostCenterId = line.CostCenterId
WHERE entry.Status = N''POSTED'';
');
GO

EXEC(N'
CREATE OR ALTER VIEW accounting.V_GeneralLedgerAccountPeriodSummary
AS
SELECT
    ledger.tenantId,
    ledger.companyId,
    ledger.accountId,
    ledger.accountCode,
    ledger.accountName,
    ledger.accountType,
    ledger.normalBalance,
    ledger.accountingPeriodId,
    ledger.fiscalYear,
    ledger.periodNumber,
    ledger.periodCode,
    ledger.costCenterId,
    ledger.costCenterCode,
    ledger.costCenterName,
    SUM(ledger.debitAmount) AS totalDebit,
    SUM(ledger.creditAmount) AS totalCredit,
    SUM(ledger.debitBaseAmount) AS totalDebitBase,
    SUM(ledger.creditBaseAmount) AS totalCreditBase,
    SUM(ledger.signedAmount) AS netMovement,
    SUM(ledger.signedBaseAmount) AS netBaseMovement,
    COUNT(1) AS movementCount,
    MIN(ledger.entryDate) AS firstMovementDate,
    MAX(ledger.entryDate) AS lastMovementDate,
    MIN(ledger.createdAt) AS createdAt,
    MAX(ledger.updatedAt) AS updatedAt,
    MIN(ledger.createdBy) AS createdBy,
    MAX(ledger.updatedBy) AS updatedBy,
    CAST(1 AS BIT) AS isActive
FROM accounting.V_GeneralLedgerEntries ledger
GROUP BY
    ledger.tenantId,
    ledger.companyId,
    ledger.accountId,
    ledger.accountCode,
    ledger.accountName,
    ledger.accountType,
    ledger.normalBalance,
    ledger.accountingPeriodId,
    ledger.fiscalYear,
    ledger.periodNumber,
    ledger.periodCode,
    ledger.costCenterId,
    ledger.costCenterCode,
    ledger.costCenterName;
');
GO
