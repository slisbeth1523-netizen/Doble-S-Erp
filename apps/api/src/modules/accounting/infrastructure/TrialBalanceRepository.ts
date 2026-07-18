import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type { TrialBalanceQuery } from "../validators/trial-balance.validators.js";

export type TrialBalanceContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type TrialBalanceAccount = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  normalBalance: "DEBIT" | "CREDIT";
  openingBalance: number | null;
  openingBaseBalance: number;
  periodDebit: number | null;
  periodCredit: number | null;
  periodDebitBase: number;
  periodCreditBase: number;
  netMovement: number | null;
  netBaseMovement: number;
  endingBalance: number | null;
  endingBaseBalance: number;
  endingDebit: number | null;
  endingCredit: number | null;
  endingDebitBase: number;
  endingCreditBase: number;
  movementCount: number;
  hasMultipleCurrencies: boolean;
  currencyTotals: TrialBalanceCurrencyTotal[];
};

export type TrialBalanceCurrencyTotal = {
  currencyCode: string;
  openingBalance: number;
  periodDebit: number;
  periodCredit: number;
  netMovement: number;
  endingBalance: number;
  endingDebit: number;
  endingCredit: number;
  movementCount: number;
};

export type TrialBalanceSummary = {
  totalDebits: number | null;
  totalCredits: number | null;
  totalDebitsBase: number;
  totalCreditsBase: number;
  difference: number | null;
  differenceBase: number;
  isBalanced: boolean;
  accountCount: number;
  movementCount: number;
  hasMultipleCurrencies: boolean;
  currencyTotals: Array<{
    currencyCode: string;
    totalDebits: number;
    totalCredits: number;
    difference: number;
    movementCount: number;
  }>;
};

type CountRow = { totalItems: number };
type CurrencyCountRow = { currencyCount: number };
type TrialBalanceRow = TrialBalanceAccount;
type TrialBalanceSummaryRow = Omit<TrialBalanceSummary, "currencyTotals" | "hasMultipleCurrencies" | "isBalanced">;

export class TrialBalanceRepository extends BaseSqlRepository {
  async listAccounts(context: TrialBalanceContextInput, query: TrialBalanceQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const offset = (page - 1) * pageSize;
    const parameters = this.parameters(context, query);
    const groupedCte = this.groupedCte(query);

    const rows = await this.query<TrialBalanceRow>(
      `
        ${groupedCte}
        SELECT *
        FROM AccountTotals
        ORDER BY accountCode
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
      `,
      [...parameters, { name: "Offset", value: offset }, { name: "Limit", value: pageSize }]
    );
    const count = await this.query<CountRow>(
      `
        ${groupedCte}
        SELECT COUNT(1) AS totalItems
        FROM AccountTotals;
      `,
      parameters
    );
    const summary = await this.getSummary(context, query);

    return {
      records: rows.map((row) => this.mapAccount(row)),
      totalItems: count[0]?.totalItems ?? 0,
      page,
      pageSize,
      summary
    };
  }

  async getSummary(context: TrialBalanceContextInput, query: TrialBalanceQuery): Promise<TrialBalanceSummary> {
    const parameters = this.parameters(context, query);
    const groupedCte = this.groupedCte(query);
    const rows = await this.query<TrialBalanceSummaryRow>(
      `
        ${groupedCte}
        SELECT
          COALESCE(SUM(endingDebit), 0) AS totalDebits,
          COALESCE(SUM(endingCredit), 0) AS totalCredits,
          COALESCE(SUM(endingDebitBase), 0) AS totalDebitsBase,
          COALESCE(SUM(endingCreditBase), 0) AS totalCreditsBase,
          COALESCE(SUM(endingDebit - endingCredit), 0) AS difference,
          COALESCE(SUM(endingDebitBase - endingCreditBase), 0) AS differenceBase,
          COUNT(1) AS accountCount,
          COALESCE(SUM(movementCount), 0) AS movementCount
        FROM AccountTotals;
      `,
      parameters
    );
    const [hasMultipleCurrencies, currencyTotals] = await Promise.all([
      this.hasMultipleCurrencies(context, query),
      this.getSummaryCurrencyTotals(context, query)
    ]);
    const row = rows[0];
    const differenceBase = this.number(row?.differenceBase);

    return {
      totalDebits: hasMultipleCurrencies ? null : this.number(row?.totalDebits),
      totalCredits: hasMultipleCurrencies ? null : this.number(row?.totalCredits),
      totalDebitsBase: this.number(row?.totalDebitsBase),
      totalCreditsBase: this.number(row?.totalCreditsBase),
      difference: hasMultipleCurrencies ? null : this.number(row?.difference),
      differenceBase,
      isBalanced: Math.abs(differenceBase) < 0.0001,
      accountCount: row?.accountCount ?? 0,
      movementCount: row?.movementCount ?? 0,
      hasMultipleCurrencies,
      currencyTotals
    };
  }

  private async hasMultipleCurrencies(context: TrialBalanceContextInput, query: TrialBalanceQuery) {
    const parameters = this.parameters(context, query);
    const rows = await this.query<CurrencyCountRow>(
      `
        WITH CurrencyScope AS (
          SELECT ledger.currencyCode
          FROM accounting.V_GeneralLedgerEntries ledger
          WHERE ${this.whereClause(query, "ledger", { includeDateRange: false })}
            AND (@DateFrom IS NOT NULL AND ledger.entryDate < @DateFrom)
          UNION
          SELECT ledger.currencyCode
          FROM accounting.V_GeneralLedgerEntries ledger
          WHERE ${this.whereClause(query, "ledger", { includeDateRange: true })}
        )
        SELECT COUNT(1) AS currencyCount
        FROM CurrencyScope;
      `,
      parameters
    );

    return Number(rows[0]?.currencyCount ?? 0) > 1;
  }

  private async getSummaryCurrencyTotals(context: TrialBalanceContextInput, query: TrialBalanceQuery) {
    const parameters = this.parameters(context, query);
    const currencyCte = this.currencyCte(query);
    const rows = await this.query<TrialBalanceSummary["currencyTotals"][number]>(
      `
        ${currencyCte}
        SELECT
          currencyCode,
          COALESCE(SUM(endingDebit), 0) AS totalDebits,
          COALESCE(SUM(endingCredit), 0) AS totalCredits,
          COALESCE(SUM(endingDebit - endingCredit), 0) AS difference,
          COALESCE(SUM(movementCount), 0) AS movementCount
        FROM CurrencyAccountTotals
        GROUP BY currencyCode
        ORDER BY currencyCode;
      `,
      parameters
    );

    return rows.map((row) => ({
      currencyCode: row.currencyCode,
      totalDebits: this.number(row.totalDebits),
      totalCredits: this.number(row.totalCredits),
      difference: this.number(row.difference),
      movementCount: row.movementCount
    }));
  }

  private groupedCte(query: TrialBalanceQuery) {
    const currencyCte = this.currencyCte(query);

    return `
      ${currencyCte},
      AccountTotals AS (
        SELECT
          accountId,
          accountCode,
          accountName,
          accountType,
          normalBalance,
          CASE WHEN COUNT(1) > 1 THEN CAST(NULL AS decimal(19, 4)) ELSE SUM(openingBalance) END AS openingBalance,
          SUM(openingBaseBalance) AS openingBaseBalance,
          CASE WHEN COUNT(1) > 1 THEN CAST(NULL AS decimal(19, 4)) ELSE SUM(periodDebit) END AS periodDebit,
          CASE WHEN COUNT(1) > 1 THEN CAST(NULL AS decimal(19, 4)) ELSE SUM(periodCredit) END AS periodCredit,
          SUM(periodDebitBase) AS periodDebitBase,
          SUM(periodCreditBase) AS periodCreditBase,
          CASE WHEN COUNT(1) > 1 THEN CAST(NULL AS decimal(19, 4)) ELSE SUM(netMovement) END AS netMovement,
          SUM(netBaseMovement) AS netBaseMovement,
          CASE WHEN COUNT(1) > 1 THEN CAST(NULL AS decimal(19, 4)) ELSE SUM(endingBalance) END AS endingBalance,
          SUM(endingBaseBalance) AS endingBaseBalance,
          CASE WHEN COUNT(1) > 1 THEN CAST(NULL AS decimal(19, 4)) ELSE SUM(endingDebit) END AS endingDebit,
          CASE WHEN COUNT(1) > 1 THEN CAST(NULL AS decimal(19, 4)) ELSE SUM(endingCredit) END AS endingCredit,
          SUM(endingDebitBase) AS endingDebitBase,
          SUM(endingCreditBase) AS endingCreditBase,
          SUM(movementCount) AS movementCount,
          CAST(CASE WHEN COUNT(1) > 1 THEN 1 ELSE 0 END AS bit) AS hasMultipleCurrencies
        FROM CurrencyAccountTotals
        GROUP BY accountId, accountCode, accountName, accountType, normalBalance
      )
    `;
  }

  private currencyCte(query: TrialBalanceQuery) {
    const openingWhere = this.whereClause(query, "ledger", { includeDateRange: false });
    const periodWhere = this.whereClause(query, "ledger", { includeDateRange: true });

    return `
      WITH Opening AS (
        SELECT
          ledger.accountId,
          ledger.accountCode,
          ledger.accountName,
          ledger.accountType,
          ledger.normalBalance,
          ledger.currencyCode,
          SUM(ledger.signedAmount) AS openingBalance,
          SUM(ledger.signedBaseAmount) AS openingBaseBalance
        FROM accounting.V_GeneralLedgerEntries ledger
        WHERE ${openingWhere}
          AND (@DateFrom IS NOT NULL AND ledger.entryDate < @DateFrom)
        GROUP BY ledger.accountId, ledger.accountCode, ledger.accountName, ledger.accountType, ledger.normalBalance, ledger.currencyCode
      ),
      Period AS (
        SELECT
          ledger.accountId,
          ledger.accountCode,
          ledger.accountName,
          ledger.accountType,
          ledger.normalBalance,
          ledger.currencyCode,
          SUM(ledger.debitAmount) AS periodDebit,
          SUM(ledger.creditAmount) AS periodCredit,
          SUM(ledger.debitBaseAmount) AS periodDebitBase,
          SUM(ledger.creditBaseAmount) AS periodCreditBase,
          SUM(ledger.signedAmount) AS netMovement,
          SUM(ledger.signedBaseAmount) AS netBaseMovement,
          COUNT(1) AS movementCount
        FROM accounting.V_GeneralLedgerEntries ledger
        WHERE ${periodWhere}
        GROUP BY ledger.accountId, ledger.accountCode, ledger.accountName, ledger.accountType, ledger.normalBalance, ledger.currencyCode
      ),
      CurrencyAccounts AS (
        SELECT accountId, accountCode, accountName, accountType, normalBalance, currencyCode FROM Opening
        UNION
        SELECT accountId, accountCode, accountName, accountType, normalBalance, currencyCode FROM Period
      ),
      CurrencyAccountTotals AS (
        SELECT
          scope.accountId,
          scope.accountCode,
          scope.accountName,
          scope.accountType,
          scope.normalBalance,
          scope.currencyCode,
          COALESCE(opening.openingBalance, 0) AS openingBalance,
          COALESCE(opening.openingBaseBalance, 0) AS openingBaseBalance,
          COALESCE(period.periodDebit, 0) AS periodDebit,
          COALESCE(period.periodCredit, 0) AS periodCredit,
          COALESCE(period.periodDebitBase, 0) AS periodDebitBase,
          COALESCE(period.periodCreditBase, 0) AS periodCreditBase,
          COALESCE(period.netMovement, 0) AS netMovement,
          COALESCE(period.netBaseMovement, 0) AS netBaseMovement,
          COALESCE(opening.openingBalance, 0) + COALESCE(period.netMovement, 0) AS endingBalance,
          COALESCE(opening.openingBaseBalance, 0) + COALESCE(period.netBaseMovement, 0) AS endingBaseBalance,
          CASE
            WHEN scope.normalBalance = N'DEBIT' AND COALESCE(opening.openingBalance, 0) + COALESCE(period.netMovement, 0) >= 0
              THEN COALESCE(opening.openingBalance, 0) + COALESCE(period.netMovement, 0)
            WHEN scope.normalBalance = N'CREDIT' AND COALESCE(opening.openingBalance, 0) + COALESCE(period.netMovement, 0) < 0
              THEN ABS(COALESCE(opening.openingBalance, 0) + COALESCE(period.netMovement, 0))
            ELSE 0
          END AS endingDebit,
          CASE
            WHEN scope.normalBalance = N'CREDIT' AND COALESCE(opening.openingBalance, 0) + COALESCE(period.netMovement, 0) >= 0
              THEN COALESCE(opening.openingBalance, 0) + COALESCE(period.netMovement, 0)
            WHEN scope.normalBalance = N'DEBIT' AND COALESCE(opening.openingBalance, 0) + COALESCE(period.netMovement, 0) < 0
              THEN ABS(COALESCE(opening.openingBalance, 0) + COALESCE(period.netMovement, 0))
            ELSE 0
          END AS endingCredit,
          CASE
            WHEN scope.normalBalance = N'DEBIT' AND COALESCE(opening.openingBaseBalance, 0) + COALESCE(period.netBaseMovement, 0) >= 0
              THEN COALESCE(opening.openingBaseBalance, 0) + COALESCE(period.netBaseMovement, 0)
            WHEN scope.normalBalance = N'CREDIT' AND COALESCE(opening.openingBaseBalance, 0) + COALESCE(period.netBaseMovement, 0) < 0
              THEN ABS(COALESCE(opening.openingBaseBalance, 0) + COALESCE(period.netBaseMovement, 0))
            ELSE 0
          END AS endingDebitBase,
          CASE
            WHEN scope.normalBalance = N'CREDIT' AND COALESCE(opening.openingBaseBalance, 0) + COALESCE(period.netBaseMovement, 0) >= 0
              THEN COALESCE(opening.openingBaseBalance, 0) + COALESCE(period.netBaseMovement, 0)
            WHEN scope.normalBalance = N'DEBIT' AND COALESCE(opening.openingBaseBalance, 0) + COALESCE(period.netBaseMovement, 0) < 0
              THEN ABS(COALESCE(opening.openingBaseBalance, 0) + COALESCE(period.netBaseMovement, 0))
            ELSE 0
          END AS endingCreditBase,
          COALESCE(period.movementCount, 0) AS movementCount
        FROM CurrencyAccounts scope
        LEFT JOIN Opening opening
          ON opening.accountId = scope.accountId AND opening.currencyCode = scope.currencyCode
        LEFT JOIN Period period
          ON period.accountId = scope.accountId AND period.currencyCode = scope.currencyCode
      )
    `;
  }

  private parameters(context: TrialBalanceContextInput, query: TrialBalanceQuery): SqlParameter[] {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "DateFrom", value: query.dateFrom ?? null }
    ];

    if (query.accountId) parameters.push({ name: "AccountId", value: query.accountId });
    if (query.accountingPeriodId) parameters.push({ name: "AccountingPeriodId", value: query.accountingPeriodId });
    if (query.fiscalYear) parameters.push({ name: "FiscalYear", value: query.fiscalYear });
    if (query.periodNumber) parameters.push({ name: "PeriodNumber", value: query.periodNumber });
    if (query.costCenterId) parameters.push({ name: "CostCenterId", value: query.costCenterId });
    if (query.sourceModule) parameters.push({ name: "SourceModule", value: query.sourceModule });
    if (query.sourceDocumentType) parameters.push({ name: "SourceDocumentType", value: query.sourceDocumentType });
    if (query.currencyCode) parameters.push({ name: "CurrencyCode", value: query.currencyCode });
    if (query.dateTo) parameters.push({ name: "DateTo", value: query.dateTo });
    if (query.search) parameters.push({ name: "Search", value: `%${query.search}%` });

    return parameters;
  }

  private whereClause(query: TrialBalanceQuery, alias: string, options: { includeDateRange: boolean }) {
    const where = [`${alias}.tenantId = @TenantId`, `${alias}.companyId = @CompanyId`];

    if (query.accountId) where.push(`${alias}.accountId = @AccountId`);
    if (query.accountingPeriodId) where.push(`${alias}.accountingPeriodId = @AccountingPeriodId`);
    if (query.fiscalYear) where.push(`${alias}.fiscalYear = @FiscalYear`);
    if (query.periodNumber) where.push(`${alias}.periodNumber = @PeriodNumber`);
    if (query.costCenterId) where.push(`${alias}.costCenterId = @CostCenterId`);
    if (query.sourceModule) where.push(`${alias}.sourceModule = @SourceModule`);
    if (query.sourceDocumentType) where.push(`${alias}.sourceDocumentType = @SourceDocumentType`);
    if (query.currencyCode) where.push(`${alias}.currencyCode = @CurrencyCode`);
    if (options.includeDateRange && query.dateFrom) where.push(`${alias}.entryDate >= @DateFrom`);
    if (options.includeDateRange && query.dateTo) where.push(`${alias}.entryDate <= @DateTo`);
    if (query.search) {
      where.push(`(
        ${alias}.entryNumber LIKE @Search OR
        ${alias}.headerDescription LIKE @Search OR
        ${alias}.lineDescription LIKE @Search OR
        ${alias}.headerReference LIKE @Search OR
        ${alias}.lineReference LIKE @Search OR
        ${alias}.accountCode LIKE @Search OR
        ${alias}.accountName LIKE @Search OR
        ${alias}.costCenterCode LIKE @Search OR
        ${alias}.costCenterName LIKE @Search
      )`);
    }

    return where.join(" AND ");
  }

  private mapAccount(row: TrialBalanceRow): TrialBalanceAccount {
    return {
      ...row,
      openingBalance: row.openingBalance === null ? null : this.number(row.openingBalance),
      openingBaseBalance: this.number(row.openingBaseBalance),
      periodDebit: row.periodDebit === null ? null : this.number(row.periodDebit),
      periodCredit: row.periodCredit === null ? null : this.number(row.periodCredit),
      periodDebitBase: this.number(row.periodDebitBase),
      periodCreditBase: this.number(row.periodCreditBase),
      netMovement: row.netMovement === null ? null : this.number(row.netMovement),
      netBaseMovement: this.number(row.netBaseMovement),
      endingBalance: row.endingBalance === null ? null : this.number(row.endingBalance),
      endingBaseBalance: this.number(row.endingBaseBalance),
      endingDebit: row.endingDebit === null ? null : this.number(row.endingDebit),
      endingCredit: row.endingCredit === null ? null : this.number(row.endingCredit),
      endingDebitBase: this.number(row.endingDebitBase),
      endingCreditBase: this.number(row.endingCreditBase),
      movementCount: Number(row.movementCount),
      hasMultipleCurrencies: Boolean(row.hasMultipleCurrencies),
      currencyTotals: []
    };
  }

  private number(value: number | null | undefined) {
    return Number(value ?? 0);
  }
}

export const trialBalanceRepository = new TrialBalanceRepository();
