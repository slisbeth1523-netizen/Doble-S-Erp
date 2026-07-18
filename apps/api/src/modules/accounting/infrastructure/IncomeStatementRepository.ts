import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type { IncomeStatementQuery } from "../validators/income-statement.validators.js";

export type IncomeStatementContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type IncomeStatementSection =
  | "REVENUE"
  | "COST"
  | "OPERATING_EXPENSE"
  | "OTHER_INCOME"
  | "OTHER_EXPENSE";

export type IncomeStatementLine = {
  section: IncomeStatementSection;
  sectionLabel: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  classification?: string;
  amount: number | null;
  baseAmount: number;
  comparisonAmount?: number | null;
  comparisonBaseAmount?: number;
  variance?: number | null;
  varianceBase?: number;
  hasMultipleCurrencies: boolean;
  currencyTotals: IncomeStatementCurrencyTotal[];
  movementCount: number;
};

export type IncomeStatementCurrencyTotal = {
  currencyCode: string;
  amount: number;
  comparisonAmount?: number;
  variance?: number;
  movementCount: number;
};

export type IncomeStatementSummary = {
  totalRevenue: number | null;
  totalRevenueBase: number;
  costs: number | null;
  costsBase: number;
  grossProfit: number | null;
  grossProfitBase: number;
  operatingExpenses: number | null;
  operatingExpensesBase: number;
  operatingIncome: number | null;
  operatingIncomeBase: number;
  otherIncome: number | null;
  otherIncomeBase: number;
  otherExpenses: number | null;
  otherExpensesBase: number;
  profitBeforeTax: number | null;
  profitBeforeTaxBase: number;
  netIncome: number | null;
  netIncomeBase: number;
  comparison?: IncomeStatementComparisonSummary;
  hasMultipleCurrencies: boolean;
  currencyTotals: IncomeStatementSummaryCurrencyTotal[];
  movementCount: number;
};

export type IncomeStatementComparisonSummary = {
  totalRevenue: number | null;
  totalRevenueBase: number;
  costs: number | null;
  costsBase: number;
  grossProfit: number | null;
  grossProfitBase: number;
  operatingExpenses: number | null;
  operatingExpensesBase: number;
  operatingIncome: number | null;
  operatingIncomeBase: number;
  otherIncome: number | null;
  otherIncomeBase: number;
  otherExpenses: number | null;
  otherExpensesBase: number;
  profitBeforeTax: number | null;
  profitBeforeTaxBase: number;
  netIncome: number | null;
  netIncomeBase: number;
  varianceNetIncome: number | null;
  varianceNetIncomeBase: number;
};

export type IncomeStatementSummaryCurrencyTotal = {
  currencyCode: string;
  totalRevenue: number;
  costs: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingIncome: number;
  otherIncome: number;
  otherExpenses: number;
  profitBeforeTax: number;
  netIncome: number;
  comparisonNetIncome?: number;
  varianceNetIncome?: number;
  movementCount: number;
};

type LineRow = {
  section: IncomeStatementSection;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  classification?: string | null;
  amount: number | null;
  baseAmount: number;
  comparisonAmount?: number | null;
  comparisonBaseAmount?: number | null;
  movementCount: number;
};

type SummaryRow = Omit<IncomeStatementSummary, "comparison" | "currencyTotals" | "hasMultipleCurrencies">;
type CurrencyCountRow = { currencyCount: number };

export class IncomeStatementRepository extends BaseSqlRepository {
  async getStatement(context: IncomeStatementContextInput, query: IncomeStatementQuery) {
    const [lines, summary] = await Promise.all([
      this.listLines(context, query),
      this.getSummary(context, query)
    ]);

    return { records: lines, summary };
  }

  async getSummary(context: IncomeStatementContextInput, query: IncomeStatementQuery): Promise<IncomeStatementSummary> {
    const parameters = this.parameters(context, query);
    const cte = this.accountTotalsCte(query);
    const rows = await this.query<SummaryRow>(
      `
        ${cte}
        SELECT
          COALESCE(SUM(CASE WHEN section = N'REVENUE' THEN amount ELSE 0 END), 0) AS totalRevenue,
          COALESCE(SUM(CASE WHEN section = N'REVENUE' THEN baseAmount ELSE 0 END), 0) AS totalRevenueBase,
          COALESCE(SUM(CASE WHEN section = N'COST' THEN amount ELSE 0 END), 0) AS costs,
          COALESCE(SUM(CASE WHEN section = N'COST' THEN baseAmount ELSE 0 END), 0) AS costsBase,
          COALESCE(SUM(CASE WHEN section = N'REVENUE' THEN amount WHEN section = N'COST' THEN -amount ELSE 0 END), 0) AS grossProfit,
          COALESCE(SUM(CASE WHEN section = N'REVENUE' THEN baseAmount WHEN section = N'COST' THEN -baseAmount ELSE 0 END), 0) AS grossProfitBase,
          COALESCE(SUM(CASE WHEN section = N'OPERATING_EXPENSE' THEN amount ELSE 0 END), 0) AS operatingExpenses,
          COALESCE(SUM(CASE WHEN section = N'OPERATING_EXPENSE' THEN baseAmount ELSE 0 END), 0) AS operatingExpensesBase,
          COALESCE(SUM(CASE WHEN section = N'REVENUE' THEN amount WHEN section IN (N'COST', N'OPERATING_EXPENSE') THEN -amount ELSE 0 END), 0) AS operatingIncome,
          COALESCE(SUM(CASE WHEN section = N'REVENUE' THEN baseAmount WHEN section IN (N'COST', N'OPERATING_EXPENSE') THEN -baseAmount ELSE 0 END), 0) AS operatingIncomeBase,
          COALESCE(SUM(CASE WHEN section = N'OTHER_INCOME' THEN amount ELSE 0 END), 0) AS otherIncome,
          COALESCE(SUM(CASE WHEN section = N'OTHER_INCOME' THEN baseAmount ELSE 0 END), 0) AS otherIncomeBase,
          COALESCE(SUM(CASE WHEN section = N'OTHER_EXPENSE' THEN amount ELSE 0 END), 0) AS otherExpenses,
          COALESCE(SUM(CASE WHEN section = N'OTHER_EXPENSE' THEN baseAmount ELSE 0 END), 0) AS otherExpensesBase,
          COALESCE(SUM(CASE WHEN section IN (N'REVENUE', N'OTHER_INCOME') THEN amount WHEN section IN (N'COST', N'OPERATING_EXPENSE', N'OTHER_EXPENSE') THEN -amount ELSE 0 END), 0) AS profitBeforeTax,
          COALESCE(SUM(CASE WHEN section IN (N'REVENUE', N'OTHER_INCOME') THEN baseAmount WHEN section IN (N'COST', N'OPERATING_EXPENSE', N'OTHER_EXPENSE') THEN -baseAmount ELSE 0 END), 0) AS profitBeforeTaxBase,
          COALESCE(SUM(CASE WHEN section IN (N'REVENUE', N'OTHER_INCOME') THEN amount WHEN section IN (N'COST', N'OPERATING_EXPENSE', N'OTHER_EXPENSE') THEN -amount ELSE 0 END), 0) AS netIncome,
          COALESCE(SUM(CASE WHEN section IN (N'REVENUE', N'OTHER_INCOME') THEN baseAmount WHEN section IN (N'COST', N'OPERATING_EXPENSE', N'OTHER_EXPENSE') THEN -baseAmount ELSE 0 END), 0) AS netIncomeBase,
          COALESCE(SUM(movementCount), 0) AS movementCount
        FROM AccountTotals;
      `,
      parameters
    );
    const [hasMultipleCurrencies, currencyTotals] = await Promise.all([
      this.hasMultipleCurrencies(context, query),
      this.getCurrencySummary(context, query)
    ]);
    const current = this.mapSummary(rows[0], hasMultipleCurrencies, currencyTotals);
    if (!this.hasComparison(query)) return current;

    const comparisonQuery = this.comparisonQuery(query);
    const [comparisonRaw, comparisonHasMultipleCurrencies] = await Promise.all([
      this.getSummary(context, comparisonQuery),
      this.hasMultipleCurrencies(context, comparisonQuery)
    ]);
    const comparisonMulti = hasMultipleCurrencies || comparisonHasMultipleCurrencies;

    return {
      ...current,
      totalRevenue: comparisonMulti ? null : current.totalRevenue,
      costs: comparisonMulti ? null : current.costs,
      grossProfit: comparisonMulti ? null : current.grossProfit,
      operatingExpenses: comparisonMulti ? null : current.operatingExpenses,
      operatingIncome: comparisonMulti ? null : current.operatingIncome,
      otherIncome: comparisonMulti ? null : current.otherIncome,
      otherExpenses: comparisonMulti ? null : current.otherExpenses,
      profitBeforeTax: comparisonMulti ? null : current.profitBeforeTax,
      netIncome: comparisonMulti ? null : current.netIncome,
      hasMultipleCurrencies: comparisonMulti,
      comparison: {
        totalRevenue: comparisonMulti ? null : comparisonRaw.totalRevenue,
        totalRevenueBase: comparisonRaw.totalRevenueBase,
        costs: comparisonMulti ? null : comparisonRaw.costs,
        costsBase: comparisonRaw.costsBase,
        grossProfit: comparisonMulti ? null : comparisonRaw.grossProfit,
        grossProfitBase: comparisonRaw.grossProfitBase,
        operatingExpenses: comparisonMulti ? null : comparisonRaw.operatingExpenses,
        operatingExpensesBase: comparisonRaw.operatingExpensesBase,
        operatingIncome: comparisonMulti ? null : comparisonRaw.operatingIncome,
        operatingIncomeBase: comparisonRaw.operatingIncomeBase,
        otherIncome: comparisonMulti ? null : comparisonRaw.otherIncome,
        otherIncomeBase: comparisonRaw.otherIncomeBase,
        otherExpenses: comparisonMulti ? null : comparisonRaw.otherExpenses,
        otherExpensesBase: comparisonRaw.otherExpensesBase,
        profitBeforeTax: comparisonMulti ? null : comparisonRaw.profitBeforeTax,
        profitBeforeTaxBase: comparisonRaw.profitBeforeTaxBase,
        netIncome: comparisonMulti ? null : comparisonRaw.netIncome,
        netIncomeBase: comparisonRaw.netIncomeBase,
        varianceNetIncome: comparisonMulti ? null : this.number(current.netIncome) - this.number(comparisonRaw.netIncome),
        varianceNetIncomeBase: current.netIncomeBase - comparisonRaw.netIncomeBase
      }
    };
  }

  private async listLines(context: IncomeStatementContextInput, query: IncomeStatementQuery) {
    const parameters = this.parameters(context, query);
    const cte = this.accountTotalsCte(query);
    const rows = await this.query<LineRow>(
      `
        ${cte}
        SELECT *
        FROM AccountTotals
        ORDER BY
          CASE section
            WHEN N'REVENUE' THEN 1
            WHEN N'COST' THEN 2
            WHEN N'OPERATING_EXPENSE' THEN 3
            WHEN N'OTHER_INCOME' THEN 4
            WHEN N'OTHER_EXPENSE' THEN 5
            ELSE 9
          END,
          accountCode;
      `,
      parameters
    );
    const hasMultipleCurrencies = await this.hasMultipleCurrencies(context, query);

    return rows.map((row) => this.mapLine(row, hasMultipleCurrencies));
  }

  private accountTotalsCte(query: IncomeStatementQuery) {
    const currentWhere = this.whereClause(query, "ledger", "current");
    const comparisonWhere = this.whereClause(query, "ledger", "comparison");

    return `
      WITH CurrentPeriod AS (
        SELECT
          ledger.accountId,
          ledger.accountCode,
          ledger.accountName,
          ledger.accountType,
          ledger.currencyCode,
          CAST(N'' AS nvarchar(40)) AS classification,
          ${this.sectionCase("ledger")} AS section,
          SUM(ledger.signedAmount) AS amount,
          SUM(ledger.signedBaseAmount) AS baseAmount,
          COUNT(1) AS movementCount
        FROM accounting.V_GeneralLedgerEntries ledger
        WHERE ${currentWhere}
          AND ledger.accountType IN (N'REVENUE', N'EXPENSE', N'COST')
        GROUP BY ledger.accountId, ledger.accountCode, ledger.accountName, ledger.accountType, ledger.currencyCode, ${this.sectionCase("ledger")}
      ),
      ComparisonPeriod AS (
        SELECT
          ledger.accountId,
          ledger.currencyCode,
          SUM(ledger.signedAmount) AS comparisonAmount,
          SUM(ledger.signedBaseAmount) AS comparisonBaseAmount
        FROM accounting.V_GeneralLedgerEntries ledger
        WHERE ${comparisonWhere}
          AND ledger.accountType IN (N'REVENUE', N'EXPENSE', N'COST')
        GROUP BY ledger.accountId, ledger.currencyCode
      ),
      CurrencyAccountTotals AS (
        SELECT
          currentPeriod.section,
          currentPeriod.accountId,
          currentPeriod.accountCode,
          currentPeriod.accountName,
          currentPeriod.accountType,
          currentPeriod.classification,
          currentPeriod.currencyCode,
          currentPeriod.amount,
          currentPeriod.baseAmount,
          comparison.comparisonAmount,
          comparison.comparisonBaseAmount,
          currentPeriod.movementCount
        FROM CurrentPeriod currentPeriod
        LEFT JOIN ComparisonPeriod comparison
          ON comparison.accountId = currentPeriod.accountId AND comparison.currencyCode = currentPeriod.currencyCode
      ),
      AccountTotals AS (
        SELECT
          section,
          accountId,
          accountCode,
          accountName,
          accountType,
          NULLIF(MAX(classification), N'') AS classification,
          CASE WHEN COUNT(1) > 1 THEN CAST(NULL AS decimal(19, 4)) ELSE SUM(amount) END AS amount,
          SUM(baseAmount) AS baseAmount,
          CASE WHEN COUNT(1) > 1 THEN CAST(NULL AS decimal(19, 4)) ELSE SUM(comparisonAmount) END AS comparisonAmount,
          SUM(COALESCE(comparisonBaseAmount, 0)) AS comparisonBaseAmount,
          SUM(movementCount) AS movementCount
        FROM CurrencyAccountTotals
        GROUP BY section, accountId, accountCode, accountName, accountType
      )
    `;
  }

  private async hasMultipleCurrencies(context: IncomeStatementContextInput, query: IncomeStatementQuery) {
    const parameters = this.parameters(context, query);
    const currentWhere = this.whereClause(query, "ledger", "current");
    const comparisonWhere = this.whereClause(query, "ledger", "comparison");
    const rows = await this.query<CurrencyCountRow>(
      `
        WITH CurrencyScope AS (
          SELECT ledger.currencyCode
          FROM accounting.V_GeneralLedgerEntries ledger
          WHERE ${currentWhere}
            AND ledger.accountType IN (N'REVENUE', N'EXPENSE', N'COST')
          UNION
          SELECT ledger.currencyCode
          FROM accounting.V_GeneralLedgerEntries ledger
          WHERE ${comparisonWhere}
            AND ledger.accountType IN (N'REVENUE', N'EXPENSE', N'COST')
        )
        SELECT COUNT(1) AS currencyCount
        FROM CurrencyScope;
      `,
      parameters
    );

    return Number(rows[0]?.currencyCount ?? 0) > 1;
  }

  private async getCurrencySummary(context: IncomeStatementContextInput, query: IncomeStatementQuery) {
    const parameters = this.parameters(context, query);
    const currentWhere = this.whereClause(query, "ledger", "current");
    const comparisonWhere = this.whereClause(query, "ledger", "comparison");
    const rows = await this.query<IncomeStatementSummaryCurrencyTotal>(
      `
        WITH CurrentPeriod AS (
          SELECT
            ledger.currencyCode,
            ${this.sectionCase("ledger")} AS section,
            SUM(ledger.signedAmount) AS amount,
            COUNT(1) AS movementCount
          FROM accounting.V_GeneralLedgerEntries ledger
          WHERE ${currentWhere}
            AND ledger.accountType IN (N'REVENUE', N'EXPENSE', N'COST')
          GROUP BY ledger.currencyCode, ${this.sectionCase("ledger")}
        ),
        ComparisonPeriod AS (
          SELECT
            ledger.currencyCode,
            SUM(CASE WHEN ${this.sectionCase("ledger")} IN (N'REVENUE', N'OTHER_INCOME') THEN ledger.signedAmount ELSE -ledger.signedAmount END) AS comparisonNetIncome
          FROM accounting.V_GeneralLedgerEntries ledger
          WHERE ${comparisonWhere}
            AND ledger.accountType IN (N'REVENUE', N'EXPENSE', N'COST')
          GROUP BY ledger.currencyCode
        )
        SELECT
          currentPeriod.currencyCode,
          COALESCE(SUM(CASE WHEN currentPeriod.section = N'REVENUE' THEN currentPeriod.amount ELSE 0 END), 0) AS totalRevenue,
          COALESCE(SUM(CASE WHEN currentPeriod.section = N'COST' THEN currentPeriod.amount ELSE 0 END), 0) AS costs,
          COALESCE(SUM(CASE WHEN currentPeriod.section = N'REVENUE' THEN currentPeriod.amount WHEN currentPeriod.section = N'COST' THEN -currentPeriod.amount ELSE 0 END), 0) AS grossProfit,
          COALESCE(SUM(CASE WHEN currentPeriod.section = N'OPERATING_EXPENSE' THEN currentPeriod.amount ELSE 0 END), 0) AS operatingExpenses,
          COALESCE(SUM(CASE WHEN currentPeriod.section = N'REVENUE' THEN currentPeriod.amount WHEN currentPeriod.section IN (N'COST', N'OPERATING_EXPENSE') THEN -currentPeriod.amount ELSE 0 END), 0) AS operatingIncome,
          COALESCE(SUM(CASE WHEN currentPeriod.section = N'OTHER_INCOME' THEN currentPeriod.amount ELSE 0 END), 0) AS otherIncome,
          COALESCE(SUM(CASE WHEN currentPeriod.section = N'OTHER_EXPENSE' THEN currentPeriod.amount ELSE 0 END), 0) AS otherExpenses,
          COALESCE(SUM(CASE WHEN currentPeriod.section IN (N'REVENUE', N'OTHER_INCOME') THEN currentPeriod.amount WHEN currentPeriod.section IN (N'COST', N'OPERATING_EXPENSE', N'OTHER_EXPENSE') THEN -currentPeriod.amount ELSE 0 END), 0) AS profitBeforeTax,
          COALESCE(SUM(CASE WHEN currentPeriod.section IN (N'REVENUE', N'OTHER_INCOME') THEN currentPeriod.amount WHEN currentPeriod.section IN (N'COST', N'OPERATING_EXPENSE', N'OTHER_EXPENSE') THEN -currentPeriod.amount ELSE 0 END), 0) AS netIncome,
          comparison.comparisonNetIncome,
          COALESCE(SUM(CASE WHEN currentPeriod.section IN (N'REVENUE', N'OTHER_INCOME') THEN currentPeriod.amount WHEN currentPeriod.section IN (N'COST', N'OPERATING_EXPENSE', N'OTHER_EXPENSE') THEN -currentPeriod.amount ELSE 0 END), 0) - COALESCE(comparison.comparisonNetIncome, 0) AS varianceNetIncome,
          COALESCE(SUM(currentPeriod.movementCount), 0) AS movementCount
        FROM CurrentPeriod currentPeriod
        LEFT JOIN ComparisonPeriod comparison ON comparison.currencyCode = currentPeriod.currencyCode
        GROUP BY currentPeriod.currencyCode, comparison.comparisonNetIncome
        ORDER BY currentPeriod.currencyCode;
      `,
      parameters
    );

    return rows.map((row) => ({
      currencyCode: row.currencyCode,
      totalRevenue: this.number(row.totalRevenue),
      costs: this.number(row.costs),
      grossProfit: this.number(row.grossProfit),
      operatingExpenses: this.number(row.operatingExpenses),
      operatingIncome: this.number(row.operatingIncome),
      otherIncome: this.number(row.otherIncome),
      otherExpenses: this.number(row.otherExpenses),
      profitBeforeTax: this.number(row.profitBeforeTax),
      netIncome: this.number(row.netIncome),
      comparisonNetIncome: row.comparisonNetIncome === undefined ? undefined : this.number(row.comparisonNetIncome),
      varianceNetIncome: row.varianceNetIncome === undefined ? undefined : this.number(row.varianceNetIncome),
      movementCount: Number(row.movementCount)
    }));
  }

  private sectionCase(ledgerAlias: string) {
    return `CASE
      WHEN ${ledgerAlias}.accountType = N'COST' OR ${ledgerAlias}.accountCode LIKE N'6%' THEN N'COST'
      WHEN ${ledgerAlias}.accountType = N'REVENUE' AND ${ledgerAlias}.accountCode LIKE N'7%' THEN N'OTHER_INCOME'
      WHEN ${ledgerAlias}.accountType = N'EXPENSE' AND ${ledgerAlias}.accountCode LIKE N'8%' THEN N'OTHER_EXPENSE'
      WHEN ${ledgerAlias}.accountType = N'REVENUE' THEN N'REVENUE'
      WHEN ${ledgerAlias}.accountType = N'EXPENSE' THEN N'OPERATING_EXPENSE'
      ELSE N'OPERATING_EXPENSE'
    END`;
  }

  private whereClause(query: IncomeStatementQuery, alias: string, scope: "current" | "comparison") {
    const where = [`${alias}.tenantId = @TenantId`, `${alias}.companyId = @CompanyId`];
    const prefix = scope === "comparison" ? "Compare" : "";
    const accountingPeriodId = scope === "comparison" ? query.compareAccountingPeriodId : query.accountingPeriodId;
    const dateFrom = scope === "comparison" ? query.compareDateFrom : query.dateFrom;
    const dateTo = scope === "comparison" ? query.compareDateTo : query.dateTo;

    if (accountingPeriodId) where.push(`${alias}.accountingPeriodId = @${prefix}AccountingPeriodId`);
    if (scope === "current" && query.fiscalYear) where.push(`${alias}.fiscalYear = @FiscalYear`);
    if (scope === "current" && query.periodNumber) where.push(`${alias}.periodNumber = @PeriodNumber`);
    if (query.costCenterId) where.push(`${alias}.costCenterId = @CostCenterId`);
    if (query.sourceModule) where.push(`${alias}.sourceModule = @SourceModule`);
    if (query.sourceDocumentType) where.push(`${alias}.sourceDocumentType = @SourceDocumentType`);
    if (query.currencyCode) where.push(`${alias}.currencyCode = @CurrencyCode`);
    if (dateFrom) where.push(`${alias}.entryDate >= @${prefix}DateFrom`);
    if (dateTo) where.push(`${alias}.entryDate <= @${prefix}DateTo`);
    if (scope === "comparison" && !this.hasComparison(query)) where.push("1 = 0");
    if (query.search) {
      where.push(`(
        ${alias}.accountCode LIKE @Search OR
        ${alias}.accountName LIKE @Search OR
        ${alias}.entryNumber LIKE @Search OR
        ${alias}.headerReference LIKE @Search OR
        ${alias}.lineReference LIKE @Search
      )`);
    }

    return where.join(" AND ");
  }

  private parameters(context: IncomeStatementContextInput, query: IncomeStatementQuery): SqlParameter[] {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId }
    ];

    if (query.accountingPeriodId) parameters.push({ name: "AccountingPeriodId", value: query.accountingPeriodId });
    if (query.fiscalYear) parameters.push({ name: "FiscalYear", value: query.fiscalYear });
    if (query.periodNumber) parameters.push({ name: "PeriodNumber", value: query.periodNumber });
    if (query.costCenterId) parameters.push({ name: "CostCenterId", value: query.costCenterId });
    if (query.sourceModule) parameters.push({ name: "SourceModule", value: query.sourceModule });
    if (query.sourceDocumentType) parameters.push({ name: "SourceDocumentType", value: query.sourceDocumentType });
    if (query.currencyCode) parameters.push({ name: "CurrencyCode", value: query.currencyCode });
    if (query.dateFrom) parameters.push({ name: "DateFrom", value: query.dateFrom });
    if (query.dateTo) parameters.push({ name: "DateTo", value: query.dateTo });
    if (query.compareAccountingPeriodId) parameters.push({ name: "CompareAccountingPeriodId", value: query.compareAccountingPeriodId });
    if (query.compareDateFrom) parameters.push({ name: "CompareDateFrom", value: query.compareDateFrom });
    if (query.compareDateTo) parameters.push({ name: "CompareDateTo", value: query.compareDateTo });
    if (query.search) parameters.push({ name: "Search", value: `%${query.search}%` });

    return parameters;
  }

  private comparisonQuery(query: IncomeStatementQuery): IncomeStatementQuery {
    return {
      ...query,
      accountingPeriodId: query.compareAccountingPeriodId,
      dateFrom: query.compareDateFrom,
      dateTo: query.compareDateTo,
      compareAccountingPeriodId: undefined,
      compareDateFrom: undefined,
      compareDateTo: undefined
    };
  }

  private hasComparison(query: IncomeStatementQuery) {
    return Boolean(query.compareAccountingPeriodId || query.compareDateFrom || query.compareDateTo);
  }

  private mapLine(row: LineRow, reportHasMultipleCurrencies: boolean): IncomeStatementLine {
    const hasMultipleCurrencies = reportHasMultipleCurrencies || row.amount === null;
    const comparisonAmount = hasMultipleCurrencies ? null : row.comparisonAmount ?? 0;

    return {
      section: row.section,
      sectionLabel: this.sectionLabel(row.section),
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      accountType: row.accountType,
      classification: row.classification ?? undefined,
      amount: hasMultipleCurrencies ? null : this.number(row.amount),
      baseAmount: this.number(row.baseAmount),
      comparisonAmount,
      comparisonBaseAmount: this.number(row.comparisonBaseAmount),
      variance: hasMultipleCurrencies ? null : this.number(row.amount) - this.number(comparisonAmount),
      varianceBase: this.number(row.baseAmount) - this.number(row.comparisonBaseAmount),
      hasMultipleCurrencies,
      currencyTotals: [],
      movementCount: Number(row.movementCount)
    };
  }

  private mapSummary(
    row: SummaryRow | undefined,
    hasMultipleCurrencies: boolean,
    currencyTotals: IncomeStatementSummaryCurrencyTotal[]
  ): IncomeStatementSummary {
    return {
      totalRevenue: hasMultipleCurrencies ? null : this.number(row?.totalRevenue),
      totalRevenueBase: this.number(row?.totalRevenueBase),
      costs: hasMultipleCurrencies ? null : this.number(row?.costs),
      costsBase: this.number(row?.costsBase),
      grossProfit: hasMultipleCurrencies ? null : this.number(row?.grossProfit),
      grossProfitBase: this.number(row?.grossProfitBase),
      operatingExpenses: hasMultipleCurrencies ? null : this.number(row?.operatingExpenses),
      operatingExpensesBase: this.number(row?.operatingExpensesBase),
      operatingIncome: hasMultipleCurrencies ? null : this.number(row?.operatingIncome),
      operatingIncomeBase: this.number(row?.operatingIncomeBase),
      otherIncome: hasMultipleCurrencies ? null : this.number(row?.otherIncome),
      otherIncomeBase: this.number(row?.otherIncomeBase),
      otherExpenses: hasMultipleCurrencies ? null : this.number(row?.otherExpenses),
      otherExpensesBase: this.number(row?.otherExpensesBase),
      profitBeforeTax: hasMultipleCurrencies ? null : this.number(row?.profitBeforeTax),
      profitBeforeTaxBase: this.number(row?.profitBeforeTaxBase),
      netIncome: hasMultipleCurrencies ? null : this.number(row?.netIncome),
      netIncomeBase: this.number(row?.netIncomeBase),
      hasMultipleCurrencies,
      currencyTotals,
      movementCount: Number(row?.movementCount ?? 0)
    };
  }

  private sectionLabel(section: IncomeStatementSection) {
    const labels: Record<IncomeStatementSection, string> = {
      REVENUE: "Ingresos",
      COST: "Costos",
      OPERATING_EXPENSE: "Gastos operativos",
      OTHER_INCOME: "Otros ingresos",
      OTHER_EXPENSE: "Otros gastos"
    };

    return labels[section];
  }

  private number(value: number | null | undefined) {
    return Number(value ?? 0);
  }
}

export const incomeStatementRepository = new IncomeStatementRepository();
