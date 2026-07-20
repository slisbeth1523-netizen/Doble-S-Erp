import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import { incomeStatementRepository } from "./IncomeStatementRepository.js";
import type { BalanceSheetQuery } from "../validators/balance-sheet.validators.js";

export type BalanceSheetContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type BalanceSheetSection =
  | "CURRENT_ASSET"
  | "NON_CURRENT_ASSET"
  | "CURRENT_LIABILITY"
  | "NON_CURRENT_LIABILITY"
  | "CAPITAL"
  | "RESERVES"
  | "RETAINED_EARNINGS"
  | "CURRENT_YEAR_RESULT";

export type BalanceSheetLine = {
  section: BalanceSheetSection;
  sectionLabel: string;
  accountId?: string;
  accountCode: string;
  accountName: string;
  accountType: "ASSET" | "LIABILITY" | "EQUITY" | "RESULT";
  amount: number | null;
  baseAmount: number;
  comparisonAmount?: number | null;
  comparisonBaseAmount?: number;
  variance?: number | null;
  varianceBase?: number;
  hasMultipleCurrencies: boolean;
  movementCount: number;
};

export type BalanceSheetSummary = {
  totalAssets: number | null;
  totalAssetsBase: number;
  totalLiabilities: number | null;
  totalLiabilitiesBase: number;
  totalEquity: number | null;
  totalEquityBase: number;
  currentYearResult: number | null;
  currentYearResultBase: number;
  difference: number | null;
  differenceBase: number;
  isBalanced: boolean;
  comparison?: BalanceSheetComparisonSummary;
  hasMultipleCurrencies: boolean;
  currencyTotals: BalanceSheetCurrencyTotal[];
  movementCount: number;
};

export type BalanceSheetComparisonSummary = {
  totalAssets: number | null;
  totalAssetsBase: number;
  totalLiabilities: number | null;
  totalLiabilitiesBase: number;
  totalEquity: number | null;
  totalEquityBase: number;
  currentYearResult: number | null;
  currentYearResultBase: number;
  difference: number | null;
  differenceBase: number;
  isBalanced: boolean;
};

export type BalanceSheetCurrencyTotal = {
  currencyCode: string;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  currentYearResult: number;
  difference: number;
  movementCount: number;
};

type BalanceRow = {
  section: BalanceSheetSection;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: "ASSET" | "LIABILITY" | "EQUITY";
  amount: number | null;
  baseAmount: number;
  comparisonAmount?: number | null;
  comparisonBaseAmount?: number | null;
  movementCount: number;
};
type CurrencyCountRow = { currencyCount: number };
type CurrencyTotalRow = Omit<BalanceSheetCurrencyTotal, "currentYearResult" | "difference">;

export class BalanceSheetRepository extends BaseSqlRepository {
  async getStatement(context: BalanceSheetContextInput, query: BalanceSheetQuery) {
    const [lines, summary] = await Promise.all([this.listLines(context, query), this.getSummary(context, query)]);

    return { records: lines, summary };
  }

  async getSummary(context: BalanceSheetContextInput, query: BalanceSheetQuery): Promise<BalanceSheetSummary> {
    const [balanceRows, hasMultipleCurrencies, incomeSummary] = await Promise.all([
      this.listRawLines(context, query),
      this.hasMultipleCurrencies(context, query),
      incomeStatementRepository.getSummary(context, {
        dateTo: query.asOfDate,
        compareDateTo: query.compareAsOfDate,
        costCenterId: query.costCenterId,
        sourceModule: query.sourceModule,
        sourceDocumentType: query.sourceDocumentType,
        currencyCode: query.currencyCode,
        search: query.search
      })
    ]);
    const comparison = query.compareAsOfDate
      ? await this.getComparisonSummary(context, query, incomeSummary.hasMultipleCurrencies)
      : undefined;
    const currentYearResult = incomeSummary.netIncome;
    const currentYearResultBase = incomeSummary.netIncomeBase;
    const totalAssets = this.sumOriginal(balanceRows, "ASSET", hasMultipleCurrencies);
    const totalAssetsBase = this.sumBase(balanceRows, "ASSET");
    const totalLiabilities = this.sumOriginal(balanceRows, "LIABILITY", hasMultipleCurrencies);
    const totalLiabilitiesBase = this.sumBase(balanceRows, "LIABILITY");
    const equityAccounts = this.sumOriginal(balanceRows, "EQUITY", hasMultipleCurrencies);
    const equityAccountsBase = this.sumBase(balanceRows, "EQUITY");
    const combinedMulti = hasMultipleCurrencies || incomeSummary.hasMultipleCurrencies;
    const totalEquity = combinedMulti ? null : this.number(equityAccounts) + this.number(currentYearResult);
    const totalEquityBase = equityAccountsBase + currentYearResultBase;
    const difference = combinedMulti ? null : this.number(totalAssets) - this.number(totalLiabilities) - this.number(totalEquity);
    const differenceBase = totalAssetsBase - totalLiabilitiesBase - totalEquityBase;
    const currencyTotals = await this.getCurrencyTotals(context, query, incomeSummary);

    return {
      totalAssets: combinedMulti ? null : this.number(totalAssets),
      totalAssetsBase,
      totalLiabilities: combinedMulti ? null : this.number(totalLiabilities),
      totalLiabilitiesBase,
      totalEquity,
      totalEquityBase,
      currentYearResult: combinedMulti ? null : this.number(currentYearResult),
      currentYearResultBase,
      difference,
      differenceBase,
      isBalanced: Math.abs(differenceBase) < 0.0001,
      comparison,
      hasMultipleCurrencies: combinedMulti,
      currencyTotals,
      movementCount: balanceRows.reduce((sum, row) => sum + Number(row.movementCount), 0) + incomeSummary.movementCount
    };
  }

  private async listLines(context: BalanceSheetContextInput, query: BalanceSheetQuery): Promise<BalanceSheetLine[]> {
    const [rows, hasMultipleCurrencies, incomeSummary] = await Promise.all([
      this.listRawLines(context, query),
      this.hasMultipleCurrencies(context, query),
      incomeStatementRepository.getSummary(context, {
        dateTo: query.asOfDate,
        compareDateTo: query.compareAsOfDate,
        costCenterId: query.costCenterId,
        sourceModule: query.sourceModule,
        sourceDocumentType: query.sourceDocumentType,
        currencyCode: query.currencyCode,
        search: query.search
      })
    ]);
    const combinedMulti = hasMultipleCurrencies || incomeSummary.hasMultipleCurrencies;
    const mapped = rows.map((row) => this.mapLine(row, combinedMulti));
    const resultLine: BalanceSheetLine = {
      section: "CURRENT_YEAR_RESULT",
      sectionLabel: "Resultado del ejercicio",
      accountCode: "IS",
      accountName: "Resultado del ejercicio",
      accountType: "RESULT",
      amount: combinedMulti ? null : this.number(incomeSummary.netIncome),
      baseAmount: incomeSummary.netIncomeBase,
      comparisonAmount: combinedMulti ? null : incomeSummary.comparison?.netIncome ?? 0,
      comparisonBaseAmount: incomeSummary.comparison?.netIncomeBase ?? 0,
      variance: combinedMulti ? null : this.number(incomeSummary.netIncome) - this.number(incomeSummary.comparison?.netIncome),
      varianceBase: incomeSummary.netIncomeBase - (incomeSummary.comparison?.netIncomeBase ?? 0),
      hasMultipleCurrencies: combinedMulti,
      movementCount: incomeSummary.movementCount
    };

    return [...mapped, resultLine];
  }

  private async listRawLines(context: BalanceSheetContextInput, query: BalanceSheetQuery) {
    const parameters = this.parameters(context, query);
    const rows = await this.query<BalanceRow>(
      `
        ${this.balanceCte(query)}
        SELECT *
        FROM AccountTotals
        ORDER BY
          CASE section
            WHEN N'CURRENT_ASSET' THEN 1
            WHEN N'NON_CURRENT_ASSET' THEN 2
            WHEN N'CURRENT_LIABILITY' THEN 3
            WHEN N'NON_CURRENT_LIABILITY' THEN 4
            WHEN N'CAPITAL' THEN 5
            WHEN N'RESERVES' THEN 6
            WHEN N'RETAINED_EARNINGS' THEN 7
            ELSE 9
          END,
          accountCode;
      `,
      parameters
    );

    return rows.map((row) => ({
      ...row,
      amount: row.amount === null ? null : this.number(row.amount),
      baseAmount: this.number(row.baseAmount),
      comparisonAmount: row.comparisonAmount === null ? null : this.number(row.comparisonAmount),
      comparisonBaseAmount: this.number(row.comparisonBaseAmount),
      movementCount: Number(row.movementCount)
    }));
  }

  private balanceCte(query: BalanceSheetQuery) {
    return `
      WITH CurrentBalances AS (
        SELECT
          ledger.accountId,
          ledger.accountCode,
          ledger.accountName,
          ledger.accountType,
          ledger.currencyCode,
          ${this.sectionCase("ledger")} AS section,
          SUM(ledger.signedAmount) AS amount,
          SUM(ledger.signedBaseAmount) AS baseAmount,
          COUNT(1) AS movementCount
        FROM accounting.V_GeneralLedgerEntries ledger
        WHERE ${this.whereClause(query, "ledger", "current")}
          AND ledger.accountType IN (N'ASSET', N'LIABILITY', N'EQUITY')
        GROUP BY ledger.accountId, ledger.accountCode, ledger.accountName, ledger.accountType, ledger.currencyCode, ${this.sectionCase("ledger")}
      ),
      ComparisonBalances AS (
        SELECT
          ledger.accountId,
          ledger.currencyCode,
          SUM(ledger.signedAmount) AS comparisonAmount,
          SUM(ledger.signedBaseAmount) AS comparisonBaseAmount
        FROM accounting.V_GeneralLedgerEntries ledger
        WHERE ${this.whereClause(query, "ledger", "comparison")}
          AND ledger.accountType IN (N'ASSET', N'LIABILITY', N'EQUITY')
        GROUP BY ledger.accountId, ledger.currencyCode
      ),
      CurrencyAccountTotals AS (
        SELECT
          currentBalances.section,
          currentBalances.accountId,
          currentBalances.accountCode,
          currentBalances.accountName,
          currentBalances.accountType,
          currentBalances.currencyCode,
          currentBalances.amount,
          currentBalances.baseAmount,
          comparison.comparisonAmount,
          comparison.comparisonBaseAmount,
          currentBalances.movementCount
        FROM CurrentBalances currentBalances
        LEFT JOIN ComparisonBalances comparison
          ON comparison.accountId = currentBalances.accountId AND comparison.currencyCode = currentBalances.currencyCode
      ),
      AccountTotals AS (
        SELECT
          section,
          accountId,
          accountCode,
          accountName,
          accountType,
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

  private async hasMultipleCurrencies(context: BalanceSheetContextInput, query: BalanceSheetQuery) {
    const rows = await this.query<CurrencyCountRow>(
      `
        WITH CurrencyScope AS (
          SELECT ledger.currencyCode
          FROM accounting.V_GeneralLedgerEntries ledger
          WHERE ${this.whereClause(query, "ledger", "current")}
            AND ledger.accountType IN (N'ASSET', N'LIABILITY', N'EQUITY')
          UNION
          SELECT ledger.currencyCode
          FROM accounting.V_GeneralLedgerEntries ledger
          WHERE ${this.whereClause(query, "ledger", "comparison")}
            AND ledger.accountType IN (N'ASSET', N'LIABILITY', N'EQUITY')
        )
        SELECT COUNT(1) AS currencyCount
        FROM CurrencyScope;
      `,
      this.parameters(context, query)
    );

    return Number(rows[0]?.currencyCount ?? 0) > 1;
  }

  private async getCurrencyTotals(
    context: BalanceSheetContextInput,
    query: BalanceSheetQuery,
    incomeSummary: Awaited<ReturnType<typeof incomeStatementRepository.getSummary>>
  ) {
    const rows = await this.query<CurrencyTotalRow>(
      `
        WITH CurrencyBalances AS (
          SELECT
            ledger.currencyCode,
            SUM(CASE WHEN ledger.accountType = N'ASSET' THEN ledger.signedAmount ELSE 0 END) AS totalAssets,
            SUM(CASE WHEN ledger.accountType = N'LIABILITY' THEN ledger.signedAmount ELSE 0 END) AS totalLiabilities,
            SUM(CASE WHEN ledger.accountType = N'EQUITY' THEN ledger.signedAmount ELSE 0 END) AS totalEquity,
            COUNT(1) AS movementCount
          FROM accounting.V_GeneralLedgerEntries ledger
          WHERE ${this.whereClause(query, "ledger", "current")}
            AND ledger.accountType IN (N'ASSET', N'LIABILITY', N'EQUITY')
          GROUP BY ledger.currencyCode
        )
        SELECT *
        FROM CurrencyBalances
        ORDER BY currencyCode;
      `,
      this.parameters(context, query)
    );
    const currencyCodes = new Set([
      ...rows.map((row) => row.currencyCode),
      ...incomeSummary.currencyTotals.map((row) => row.currencyCode)
    ]);

    return [...currencyCodes].sort().map((currencyCode) => {
      const balance = rows.find((row) => row.currencyCode === currencyCode);
      const income = incomeSummary.currencyTotals.find((row) => row.currencyCode === currencyCode);
      const currentYearResult = this.number(income?.netIncome);
      const totalAssets = this.number(balance?.totalAssets);
      const totalLiabilities = this.number(balance?.totalLiabilities);
      const totalEquity = this.number(balance?.totalEquity) + currentYearResult;

      return {
        currencyCode,
        totalAssets,
        totalLiabilities,
        totalEquity,
        currentYearResult,
        difference: totalAssets - totalLiabilities - totalEquity,
        movementCount: Number(balance?.movementCount ?? 0) + Number(income?.movementCount ?? 0)
      };
    });
  }

  private async getComparisonSummary(
    context: BalanceSheetContextInput,
    query: BalanceSheetQuery,
    currentIncomeIsMultiCurrency: boolean
  ): Promise<BalanceSheetComparisonSummary> {
    const comparisonQuery: BalanceSheetQuery = {
      ...query,
      asOfDate: query.compareAsOfDate,
      compareAsOfDate: undefined
    };
    const [rows, hasMultipleCurrencies, incomeSummary] = await Promise.all([
      this.listRawLines(context, comparisonQuery),
      this.hasMultipleCurrencies(context, comparisonQuery),
      incomeStatementRepository.getSummary(context, {
        dateTo: query.compareAsOfDate,
        costCenterId: query.costCenterId,
        sourceModule: query.sourceModule,
        sourceDocumentType: query.sourceDocumentType,
        currencyCode: query.currencyCode,
        search: query.search
      })
    ]);
    const combinedMulti = hasMultipleCurrencies || incomeSummary.hasMultipleCurrencies || currentIncomeIsMultiCurrency;
    const totalAssets = this.sumOriginal(rows, "ASSET", combinedMulti);
    const totalAssetsBase = this.sumBase(rows, "ASSET");
    const totalLiabilities = this.sumOriginal(rows, "LIABILITY", combinedMulti);
    const totalLiabilitiesBase = this.sumBase(rows, "LIABILITY");
    const equityAccounts = this.sumOriginal(rows, "EQUITY", combinedMulti);
    const equityAccountsBase = this.sumBase(rows, "EQUITY");
    const currentYearResult = combinedMulti ? null : this.number(incomeSummary.netIncome);
    const currentYearResultBase = incomeSummary.netIncomeBase;
    const totalEquity = combinedMulti ? null : this.number(equityAccounts) + this.number(currentYearResult);
    const totalEquityBase = equityAccountsBase + currentYearResultBase;
    const difference = combinedMulti ? null : this.number(totalAssets) - this.number(totalLiabilities) - this.number(totalEquity);
    const differenceBase = totalAssetsBase - totalLiabilitiesBase - totalEquityBase;

    return {
      totalAssets: combinedMulti ? null : this.number(totalAssets),
      totalAssetsBase,
      totalLiabilities: combinedMulti ? null : this.number(totalLiabilities),
      totalLiabilitiesBase,
      totalEquity,
      totalEquityBase,
      currentYearResult,
      currentYearResultBase,
      difference,
      differenceBase,
      isBalanced: Math.abs(differenceBase) < 0.0001
    };
  }

  private sectionCase(alias: string) {
    return `CASE
      WHEN ${alias}.accountType = N'ASSET' AND (${alias}.accountCode LIKE N'1-01%' OR ${alias}.accountCode LIKE N'1.01%') THEN N'CURRENT_ASSET'
      WHEN ${alias}.accountType = N'ASSET' THEN N'NON_CURRENT_ASSET'
      WHEN ${alias}.accountType = N'LIABILITY' AND (${alias}.accountCode LIKE N'2-01%' OR ${alias}.accountCode LIKE N'2.01%') THEN N'CURRENT_LIABILITY'
      WHEN ${alias}.accountType = N'LIABILITY' THEN N'NON_CURRENT_LIABILITY'
      WHEN ${alias}.accountType = N'EQUITY' AND (${alias}.accountCode LIKE N'3-02%' OR ${alias}.accountName LIKE N'%reserva%') THEN N'RESERVES'
      WHEN ${alias}.accountType = N'EQUITY' AND (${alias}.accountCode LIKE N'3-03%' OR ${alias}.accountName LIKE N'%retenida%') THEN N'RETAINED_EARNINGS'
      WHEN ${alias}.accountType = N'EQUITY' THEN N'CAPITAL'
      ELSE N'CAPITAL'
    END`;
  }

  private whereClause(query: BalanceSheetQuery, alias: string, scope: "current" | "comparison") {
    const where = [`${alias}.tenantId = @TenantId`, `${alias}.companyId = @CompanyId`];
    const date = scope === "comparison" ? query.compareAsOfDate : query.asOfDate;

    if (date) where.push(`${alias}.entryDate <= @${scope === "comparison" ? "Compare" : ""}AsOfDate`);
    if (scope === "comparison" && !query.compareAsOfDate) where.push("1 = 0");
    if (query.costCenterId) where.push(`${alias}.costCenterId = @CostCenterId`);
    if (query.sourceModule) where.push(`${alias}.sourceModule = @SourceModule`);
    if (query.sourceDocumentType) where.push(`${alias}.sourceDocumentType = @SourceDocumentType`);
    if (query.currencyCode) where.push(`${alias}.currencyCode = @CurrencyCode`);
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

  private parameters(context: BalanceSheetContextInput, query: BalanceSheetQuery): SqlParameter[] {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId }
    ];

    if (query.asOfDate) parameters.push({ name: "AsOfDate", value: query.asOfDate });
    if (query.compareAsOfDate) parameters.push({ name: "CompareAsOfDate", value: query.compareAsOfDate });
    if (query.costCenterId) parameters.push({ name: "CostCenterId", value: query.costCenterId });
    if (query.sourceModule) parameters.push({ name: "SourceModule", value: query.sourceModule });
    if (query.sourceDocumentType) parameters.push({ name: "SourceDocumentType", value: query.sourceDocumentType });
    if (query.currencyCode) parameters.push({ name: "CurrencyCode", value: query.currencyCode });
    if (query.search) parameters.push({ name: "Search", value: `%${query.search}%` });

    return parameters;
  }

  private mapLine(row: BalanceRow, hasMultipleCurrencies: boolean): BalanceSheetLine {
    const comparisonAmount = hasMultipleCurrencies ? null : row.comparisonAmount ?? 0;

    return {
      section: row.section,
      sectionLabel: this.sectionLabel(row.section),
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      accountType: row.accountType,
      amount: hasMultipleCurrencies ? null : this.number(row.amount),
      baseAmount: this.number(row.baseAmount),
      comparisonAmount,
      comparisonBaseAmount: this.number(row.comparisonBaseAmount),
      variance: hasMultipleCurrencies ? null : this.number(row.amount) - this.number(comparisonAmount),
      varianceBase: this.number(row.baseAmount) - this.number(row.comparisonBaseAmount),
      hasMultipleCurrencies,
      movementCount: Number(row.movementCount)
    };
  }

  private sectionLabel(section: BalanceSheetSection) {
    const labels: Record<BalanceSheetSection, string> = {
      CURRENT_ASSET: "Activos corrientes",
      NON_CURRENT_ASSET: "Activos no corrientes",
      CURRENT_LIABILITY: "Pasivos corrientes",
      NON_CURRENT_LIABILITY: "Pasivos no corrientes",
      CAPITAL: "Capital",
      RESERVES: "Reservas",
      RETAINED_EARNINGS: "Utilidades retenidas",
      CURRENT_YEAR_RESULT: "Resultado del ejercicio"
    };

    return labels[section];
  }

  private sumOriginal(rows: BalanceRow[], accountType: string, hasMultipleCurrencies: boolean) {
    if (hasMultipleCurrencies) return null;
    return rows.filter((row) => row.accountType === accountType).reduce((sum, row) => sum + this.number(row.amount), 0);
  }

  private sumBase(rows: BalanceRow[], accountType: string) {
    return rows.filter((row) => row.accountType === accountType).reduce((sum, row) => sum + this.number(row.baseAmount), 0);
  }

  private number(value: number | null | undefined) {
    return Number(value ?? 0);
  }
}

export const balanceSheetRepository = new BalanceSheetRepository();
