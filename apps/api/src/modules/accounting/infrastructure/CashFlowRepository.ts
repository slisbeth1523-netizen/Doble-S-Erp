import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import { incomeStatementRepository } from "./IncomeStatementRepository.js";
import type { CashFlowQuery } from "../validators/cash-flow.validators.js";

export type CashFlowContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type CashFlowSection = "OPERATING" | "INVESTING" | "FINANCING";

export type CashFlowLine = {
  section: CashFlowSection;
  sectionLabel: string;
  lineType:
    | "NET_INCOME"
    | "OPERATING_ADJUSTMENTS"
    | "WORKING_CAPITAL"
    | "ASSET_PURCHASES"
    | "ASSET_SALES"
    | "INVESTMENTS"
    | "LOANS"
    | "LOAN_PAYMENTS"
    | "CAPITAL"
    | "DIVIDENDS";
  label: string;
  amount: number | null;
  baseAmount: number;
  comparisonAmount?: number | null;
  comparisonBaseAmount?: number;
  variance?: number | null;
  varianceBase?: number;
  hasMultipleCurrencies: boolean;
};

export type CashFlowCurrencyTotal = {
  currencyCode: string;
  operatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
  netChange: number;
  beginningCash: number;
  endingCash: number;
  movementCount: number;
};

export type CashFlowSummary = {
  operatingCashFlow: number | null;
  operatingCashFlowBase: number;
  investingCashFlow: number | null;
  investingCashFlowBase: number;
  financingCashFlow: number | null;
  financingCashFlowBase: number;
  netChange: number | null;
  netChangeBase: number;
  beginningCash: number | null;
  beginningCashBase: number;
  endingCash: number | null;
  endingCashBase: number;
  comparison?: CashFlowComparisonSummary;
  hasMultipleCurrencies: boolean;
  currencyTotals: CashFlowCurrencyTotal[];
  movementCount: number;
};

export type CashFlowComparisonSummary = {
  operatingCashFlow: number | null;
  operatingCashFlowBase: number;
  investingCashFlow: number | null;
  investingCashFlowBase: number;
  financingCashFlow: number | null;
  financingCashFlowBase: number;
  netChange: number | null;
  netChangeBase: number;
  beginningCash: number | null;
  beginningCashBase: number;
  endingCash: number | null;
  endingCashBase: number;
  varianceNetChange: number | null;
  varianceNetChangeBase: number;
};

type FlowRow = {
  currencyCode: string;
  cashOpening: number;
  cashOpeningBase: number;
  cashEnding: number;
  cashEndingBase: number;
  workingCapitalChange: number;
  workingCapitalChangeBase: number;
  nonCashAssetChange: number;
  nonCashAssetChangeBase: number;
  investmentChange: number;
  investmentChangeBase: number;
  loanChange: number;
  loanChangeBase: number;
  capitalChange: number;
  capitalChangeBase: number;
  dividendMovement: number;
  dividendMovementBase: number;
  adjustmentMovement: number;
  adjustmentMovementBase: number;
  movementCount: number;
};

type CurrencyCountRow = { currencyCount: number };

type FlowCalculation = {
  lines: CashFlowLine[];
  summary: CashFlowSummary;
};

type NumericPair = {
  amount: number;
  baseAmount: number;
};

export class CashFlowRepository extends BaseSqlRepository {
  async getStatement(context: CashFlowContextInput, query: CashFlowQuery) {
    const result = await this.calculateFlow(context, query, true);

    return { records: result.lines, summary: result.summary };
  }

  async getSummary(context: CashFlowContextInput, query: CashFlowQuery) {
    return (await this.calculateFlow(context, query, true)).summary;
  }

  private async calculateFlow(context: CashFlowContextInput, query: CashFlowQuery, includeComparison: boolean): Promise<FlowCalculation> {
    const [rows, incomeSummary, hasMultipleCurrencies] = await Promise.all([
      this.flowRows(context, query),
      incomeStatementRepository.getSummary(context, {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        costCenterId: query.costCenterId,
        sourceModule: query.sourceModule,
        sourceDocumentType: query.sourceDocumentType,
        currencyCode: query.currencyCode,
        search: query.search
      }),
      this.hasMultipleCurrencies(context, query)
    ]);
    const combinedMulti = hasMultipleCurrencies || incomeSummary.hasMultipleCurrencies;
    const baseLines = this.buildLines(rows, incomeSummary, combinedMulti);
    const summary = this.buildSummary(baseLines, rows, combinedMulti, incomeSummary);

    if (!includeComparison || !this.hasComparison(query)) {
      return { lines: baseLines, summary };
    }

    const comparisonQuery: CashFlowQuery = {
      ...query,
      dateFrom: query.compareDateFrom,
      dateTo: query.compareDateTo,
      compareDateFrom: undefined,
      compareDateTo: undefined
    };
    const comparison = await this.calculateFlow(context, comparisonQuery, false);
    const comparisonMulti = combinedMulti || comparison.summary.hasMultipleCurrencies;
    const lines = baseLines.map((line) => {
      const comparisonLine = comparison.lines.find((item) => item.lineType === line.lineType);

      return {
        ...line,
        amount: comparisonMulti ? null : line.amount,
        comparisonAmount: comparisonMulti ? null : comparisonLine?.amount ?? 0,
        comparisonBaseAmount: comparisonLine?.baseAmount ?? 0,
        variance: comparisonMulti ? null : this.number(line.amount) - this.number(comparisonLine?.amount),
        varianceBase: line.baseAmount - this.number(comparisonLine?.baseAmount),
        hasMultipleCurrencies: comparisonMulti
      };
    });
    const adjustedSummary = this.buildSummary(lines, rows, comparisonMulti, incomeSummary);

    adjustedSummary.comparison = {
      operatingCashFlow: comparisonMulti ? null : comparison.summary.operatingCashFlow,
      operatingCashFlowBase: comparison.summary.operatingCashFlowBase,
      investingCashFlow: comparisonMulti ? null : comparison.summary.investingCashFlow,
      investingCashFlowBase: comparison.summary.investingCashFlowBase,
      financingCashFlow: comparisonMulti ? null : comparison.summary.financingCashFlow,
      financingCashFlowBase: comparison.summary.financingCashFlowBase,
      netChange: comparisonMulti ? null : comparison.summary.netChange,
      netChangeBase: comparison.summary.netChangeBase,
      beginningCash: comparisonMulti ? null : comparison.summary.beginningCash,
      beginningCashBase: comparison.summary.beginningCashBase,
      endingCash: comparisonMulti ? null : comparison.summary.endingCash,
      endingCashBase: comparison.summary.endingCashBase,
      varianceNetChange: comparisonMulti ? null : this.number(adjustedSummary.netChange) - this.number(comparison.summary.netChange),
      varianceNetChangeBase: adjustedSummary.netChangeBase - comparison.summary.netChangeBase
    };
    adjustedSummary.hasMultipleCurrencies = comparisonMulti;
    adjustedSummary.operatingCashFlow = comparisonMulti ? null : adjustedSummary.operatingCashFlow;
    adjustedSummary.investingCashFlow = comparisonMulti ? null : adjustedSummary.investingCashFlow;
    adjustedSummary.financingCashFlow = comparisonMulti ? null : adjustedSummary.financingCashFlow;
    adjustedSummary.netChange = comparisonMulti ? null : adjustedSummary.netChange;
    adjustedSummary.beginningCash = comparisonMulti ? null : adjustedSummary.beginningCash;
    adjustedSummary.endingCash = comparisonMulti ? null : adjustedSummary.endingCash;

    return { lines, summary: adjustedSummary };
  }

  private async flowRows(context: CashFlowContextInput, query: CashFlowQuery) {
    const rows = await this.query<FlowRow>(
      `
        WITH ClassifiedLedger AS (
          SELECT
            ledger.currencyCode,
            ledger.entryDate,
            ledger.accountType,
            ledger.signedAmount,
            ledger.signedBaseAmount,
            CASE
              WHEN ledger.accountType = N'ASSET' AND (
                ledger.accountCode LIKE N'1-01-001%' OR
                ledger.accountName LIKE N'%caja%' OR
                ledger.accountName LIKE N'%banco%' OR
                ledger.accountName LIKE N'%efectivo%'
              ) THEN 1 ELSE 0
            END AS isCash,
            CASE
              WHEN ledger.accountType = N'ASSET' AND (ledger.accountCode LIKE N'1-01%' OR ledger.accountCode LIKE N'1.01%') AND NOT (
                ledger.accountCode LIKE N'1-01-001%' OR
                ledger.accountName LIKE N'%caja%' OR
                ledger.accountName LIKE N'%banco%' OR
                ledger.accountName LIKE N'%efectivo%'
              ) THEN 1 ELSE 0
            END AS isWorkingCapitalAsset,
            CASE
              WHEN ledger.accountType = N'LIABILITY' AND (ledger.accountCode LIKE N'2-01%' OR ledger.accountCode LIKE N'2.01%') THEN 1 ELSE 0
            END AS isWorkingCapitalLiability,
            CASE
              WHEN ledger.accountType = N'ASSET' AND NOT (ledger.accountCode LIKE N'1-01%' OR ledger.accountCode LIKE N'1.01%') AND NOT (
                ledger.accountName LIKE N'%inversion%' OR ledger.accountName LIKE N'%inversiÃ³n%' OR ledger.accountName LIKE N'%investment%'
              ) THEN 1 ELSE 0
            END AS isNonCashAsset,
            CASE
              WHEN ledger.accountType = N'ASSET' AND (
                ledger.accountName LIKE N'%inversion%' OR ledger.accountName LIKE N'%inversiÃ³n%' OR ledger.accountName LIKE N'%investment%'
              ) THEN 1 ELSE 0
            END AS isInvestment,
            CASE
              WHEN ledger.accountType = N'LIABILITY' AND (
                ledger.accountCode LIKE N'2-02%' OR ledger.accountCode LIKE N'2.02%' OR
                ledger.accountName LIKE N'%prestamo%' OR ledger.accountName LIKE N'%prÃ©stamo%' OR ledger.accountName LIKE N'%loan%'
              ) THEN 1 ELSE 0
            END AS isLoan,
            CASE
              WHEN ledger.accountType = N'EQUITY' AND NOT (
                ledger.accountName LIKE N'%dividendo%' OR ledger.accountName LIKE N'%dividend%'
              ) THEN 1 ELSE 0
            END AS isCapital,
            CASE
              WHEN ledger.accountType = N'EQUITY' AND (
                ledger.accountName LIKE N'%dividendo%' OR ledger.accountName LIKE N'%dividend%'
              ) THEN 1 ELSE 0
            END AS isDividend,
            CASE
              WHEN (ledger.accountType IN (N'EXPENSE', N'COST') AND (
                ledger.accountName LIKE N'%depreciaci%' OR ledger.accountName LIKE N'%amortizaci%'
              )) OR (ledger.accountType = N'REVENUE' AND (
                ledger.accountName LIKE N'%ganancia no realizada%' OR ledger.accountName LIKE N'%ajuste no monetario%'
              )) THEN 1 ELSE 0
            END AS isOperatingAdjustment
          FROM accounting.V_GeneralLedgerEntries ledger
          WHERE ${this.whereClause(query, "ledger", "statement")}
        )
        SELECT
          currencyCode,
          COALESCE(SUM(CASE WHEN isCash = 1 AND (@DateFrom IS NULL OR entryDate < @DateFrom) THEN signedAmount ELSE 0 END), 0) AS cashOpening,
          COALESCE(SUM(CASE WHEN isCash = 1 AND (@DateFrom IS NULL OR entryDate < @DateFrom) THEN signedBaseAmount ELSE 0 END), 0) AS cashOpeningBase,
          COALESCE(SUM(CASE WHEN isCash = 1 AND (@DateTo IS NULL OR entryDate <= @DateTo) THEN signedAmount ELSE 0 END), 0) AS cashEnding,
          COALESCE(SUM(CASE WHEN isCash = 1 AND (@DateTo IS NULL OR entryDate <= @DateTo) THEN signedBaseAmount ELSE 0 END), 0) AS cashEndingBase,
          COALESCE(SUM(CASE WHEN isWorkingCapitalAsset = 1 THEN signedAmount WHEN isWorkingCapitalLiability = 1 THEN -signedAmount ELSE 0 END), 0) AS workingCapitalChange,
          COALESCE(SUM(CASE WHEN isWorkingCapitalAsset = 1 THEN signedBaseAmount WHEN isWorkingCapitalLiability = 1 THEN -signedBaseAmount ELSE 0 END), 0) AS workingCapitalChangeBase,
          COALESCE(SUM(CASE WHEN isNonCashAsset = 1 THEN signedAmount ELSE 0 END), 0) AS nonCashAssetChange,
          COALESCE(SUM(CASE WHEN isNonCashAsset = 1 THEN signedBaseAmount ELSE 0 END), 0) AS nonCashAssetChangeBase,
          COALESCE(SUM(CASE WHEN isInvestment = 1 THEN signedAmount ELSE 0 END), 0) AS investmentChange,
          COALESCE(SUM(CASE WHEN isInvestment = 1 THEN signedBaseAmount ELSE 0 END), 0) AS investmentChangeBase,
          COALESCE(SUM(CASE WHEN isLoan = 1 THEN signedAmount ELSE 0 END), 0) AS loanChange,
          COALESCE(SUM(CASE WHEN isLoan = 1 THEN signedBaseAmount ELSE 0 END), 0) AS loanChangeBase,
          COALESCE(SUM(CASE WHEN isCapital = 1 THEN signedAmount ELSE 0 END), 0) AS capitalChange,
          COALESCE(SUM(CASE WHEN isCapital = 1 THEN signedBaseAmount ELSE 0 END), 0) AS capitalChangeBase,
          COALESCE(SUM(CASE WHEN isDividend = 1 THEN signedAmount ELSE 0 END), 0) AS dividendMovement,
          COALESCE(SUM(CASE WHEN isDividend = 1 THEN signedBaseAmount ELSE 0 END), 0) AS dividendMovementBase,
          COALESCE(SUM(CASE WHEN isOperatingAdjustment = 1 THEN signedAmount ELSE 0 END), 0) AS adjustmentMovement,
          COALESCE(SUM(CASE WHEN isOperatingAdjustment = 1 THEN signedBaseAmount ELSE 0 END), 0) AS adjustmentMovementBase,
          COUNT(1) AS movementCount
        FROM ClassifiedLedger
        WHERE @DateFrom IS NULL OR entryDate >= @DateFrom OR isCash = 1
        GROUP BY currencyCode
        ORDER BY currencyCode;
      `,
      this.parameters(context, query)
    );

    return rows.map((row) => this.mapFlowRow(row));
  }

  private buildLines(
    rows: FlowRow[],
    incomeSummary: Awaited<ReturnType<typeof incomeStatementRepository.getSummary>>,
    hasMultipleCurrencies: boolean
  ): CashFlowLine[] {
    const netIncome = this.pair(incomeSummary.netIncome, incomeSummary.netIncomeBase);
    const adjustments = this.sumPair(rows, "adjustmentMovement", "adjustmentMovementBase");
    const workingCapital = this.sumPair(rows, "workingCapitalChange", "workingCapitalChangeBase");
    const assetChange = this.sumPair(rows, "nonCashAssetChange", "nonCashAssetChangeBase");
    const investmentChange = this.sumPair(rows, "investmentChange", "investmentChangeBase");
    const loanChange = this.sumPair(rows, "loanChange", "loanChangeBase");
    const capitalChange = this.sumPair(rows, "capitalChange", "capitalChangeBase");
    const dividends = this.sumPair(rows, "dividendMovement", "dividendMovementBase");

    return [
      this.line("OPERATING", "NET_INCOME", "Utilidad neta", netIncome, hasMultipleCurrencies),
      this.line("OPERATING", "OPERATING_ADJUSTMENTS", "Ajustes operativos", adjustments, hasMultipleCurrencies),
      this.line("OPERATING", "WORKING_CAPITAL", "Variaciones de capital de trabajo", this.negate(workingCapital), hasMultipleCurrencies),
      this.line("INVESTING", "ASSET_PURCHASES", "Compra de activos", this.negativeOnly(this.negate(assetChange)), hasMultipleCurrencies),
      this.line("INVESTING", "ASSET_SALES", "Venta de activos", this.positiveOnly(this.negate(assetChange)), hasMultipleCurrencies),
      this.line("INVESTING", "INVESTMENTS", "Inversiones", this.negate(investmentChange), hasMultipleCurrencies),
      this.line("FINANCING", "LOANS", "Prestamos", this.positiveOnly(loanChange), hasMultipleCurrencies),
      this.line("FINANCING", "LOAN_PAYMENTS", "Pago de prestamos", this.negativeOnly(loanChange), hasMultipleCurrencies),
      this.line("FINANCING", "CAPITAL", "Capital", this.positiveOnly(capitalChange), hasMultipleCurrencies),
      this.line("FINANCING", "DIVIDENDS", "Dividendos", this.negativeOnly(dividends), hasMultipleCurrencies)
    ];
  }

  private buildSummary(
    lines: CashFlowLine[],
    rows: FlowRow[],
    hasMultipleCurrencies: boolean,
    incomeSummary: Awaited<ReturnType<typeof incomeStatementRepository.getSummary>>
  ): CashFlowSummary {
    const operating = this.sectionTotal(lines, "OPERATING");
    const investing = this.sectionTotal(lines, "INVESTING");
    const financing = this.sectionTotal(lines, "FINANCING");
    const beginningCash = this.sumPair(rows, "cashOpening", "cashOpeningBase");
    const endingCash = this.sumPair(rows, "cashEnding", "cashEndingBase");
    const currencyTotals = this.currencyTotals(rows, incomeSummary);

    return {
      operatingCashFlow: hasMultipleCurrencies ? null : operating.amount,
      operatingCashFlowBase: operating.baseAmount,
      investingCashFlow: hasMultipleCurrencies ? null : investing.amount,
      investingCashFlowBase: investing.baseAmount,
      financingCashFlow: hasMultipleCurrencies ? null : financing.amount,
      financingCashFlowBase: financing.baseAmount,
      netChange: hasMultipleCurrencies ? null : endingCash.amount - beginningCash.amount,
      netChangeBase: endingCash.baseAmount - beginningCash.baseAmount,
      beginningCash: hasMultipleCurrencies ? null : beginningCash.amount,
      beginningCashBase: beginningCash.baseAmount,
      endingCash: hasMultipleCurrencies ? null : endingCash.amount,
      endingCashBase: endingCash.baseAmount,
      hasMultipleCurrencies,
      currencyTotals,
      movementCount: rows.reduce((sum, row) => sum + Number(row.movementCount), 0) + Number(incomeSummary.movementCount)
    };
  }

  private currencyTotals(
    rows: FlowRow[],
    incomeSummary: Awaited<ReturnType<typeof incomeStatementRepository.getSummary>>
  ): CashFlowCurrencyTotal[] {
    const currencyCodes = new Set([
      ...rows.map((row) => row.currencyCode),
      ...incomeSummary.currencyTotals.map((row) => row.currencyCode)
    ]);

    return [...currencyCodes].sort().map((currencyCode) => {
      const row = rows.find((item) => item.currencyCode === currencyCode) ?? this.emptyFlowRow(currencyCode);
      const income = incomeSummary.currencyTotals.find((item) => item.currencyCode === currencyCode);
      const operatingCashFlow =
        this.number(income?.netIncome) + row.adjustmentMovement - row.workingCapitalChange;
      const investingCashFlow =
        this.negativeOnly(this.negate(this.pair(row.nonCashAssetChange, row.nonCashAssetChangeBase))).amount +
        this.positiveOnly(this.negate(this.pair(row.nonCashAssetChange, row.nonCashAssetChangeBase))).amount -
        row.investmentChange;
      const financingCashFlow =
        this.positiveOnly(this.pair(row.loanChange, row.loanChangeBase)).amount +
        this.negativeOnly(this.pair(row.loanChange, row.loanChangeBase)).amount +
        this.positiveOnly(this.pair(row.capitalChange, row.capitalChangeBase)).amount +
        this.negativeOnly(this.pair(row.dividendMovement, row.dividendMovementBase)).amount;

      return {
        currencyCode: row.currencyCode,
        operatingCashFlow,
        investingCashFlow,
        financingCashFlow,
        netChange: row.cashEnding - row.cashOpening,
        beginningCash: row.cashOpening,
        endingCash: row.cashEnding,
        movementCount: Number(row.movementCount) + Number(income?.movementCount ?? 0)
      };
    });
  }

  private async hasMultipleCurrencies(context: CashFlowContextInput, query: CashFlowQuery) {
    const rows = await this.query<CurrencyCountRow>(
      `
        WITH CurrencyScope AS (
          SELECT ledger.currencyCode
          FROM accounting.V_GeneralLedgerEntries ledger
          WHERE ${this.whereClause(query, "ledger", "statement")}
        )
        SELECT COUNT(DISTINCT currencyCode) AS currencyCount
        FROM CurrencyScope;
      `,
      this.parameters(context, query)
    );

    return Number(rows[0]?.currencyCount ?? 0) > 1;
  }

  private whereClause(query: CashFlowQuery, alias: string, scope: "statement") {
    const where = [`${alias}.tenantId = @TenantId`, `${alias}.companyId = @CompanyId`];

    if (query.dateTo) where.push(`${alias}.entryDate <= @DateTo`);
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

  private parameters(context: CashFlowContextInput, query: CashFlowQuery): SqlParameter[] {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "DateFrom", value: query.dateFrom ?? null },
      { name: "DateTo", value: query.dateTo ?? null }
    ];

    if (query.costCenterId) parameters.push({ name: "CostCenterId", value: query.costCenterId });
    if (query.sourceModule) parameters.push({ name: "SourceModule", value: query.sourceModule });
    if (query.sourceDocumentType) parameters.push({ name: "SourceDocumentType", value: query.sourceDocumentType });
    if (query.currencyCode) parameters.push({ name: "CurrencyCode", value: query.currencyCode });
    if (query.search) parameters.push({ name: "Search", value: `%${query.search}%` });

    return parameters;
  }

  private mapFlowRow(row: FlowRow): FlowRow {
    return {
      currencyCode: row.currencyCode,
      cashOpening: this.number(row.cashOpening),
      cashOpeningBase: this.number(row.cashOpeningBase),
      cashEnding: this.number(row.cashEnding),
      cashEndingBase: this.number(row.cashEndingBase),
      workingCapitalChange: this.number(row.workingCapitalChange),
      workingCapitalChangeBase: this.number(row.workingCapitalChangeBase),
      nonCashAssetChange: this.number(row.nonCashAssetChange),
      nonCashAssetChangeBase: this.number(row.nonCashAssetChangeBase),
      investmentChange: this.number(row.investmentChange),
      investmentChangeBase: this.number(row.investmentChangeBase),
      loanChange: this.number(row.loanChange),
      loanChangeBase: this.number(row.loanChangeBase),
      capitalChange: this.number(row.capitalChange),
      capitalChangeBase: this.number(row.capitalChangeBase),
      dividendMovement: this.number(row.dividendMovement),
      dividendMovementBase: this.number(row.dividendMovementBase),
      adjustmentMovement: this.number(row.adjustmentMovement),
      adjustmentMovementBase: this.number(row.adjustmentMovementBase),
      movementCount: Number(row.movementCount)
    };
  }

  private emptyFlowRow(currencyCode: string): FlowRow {
    return {
      currencyCode,
      cashOpening: 0,
      cashOpeningBase: 0,
      cashEnding: 0,
      cashEndingBase: 0,
      workingCapitalChange: 0,
      workingCapitalChangeBase: 0,
      nonCashAssetChange: 0,
      nonCashAssetChangeBase: 0,
      investmentChange: 0,
      investmentChangeBase: 0,
      loanChange: 0,
      loanChangeBase: 0,
      capitalChange: 0,
      capitalChangeBase: 0,
      dividendMovement: 0,
      dividendMovementBase: 0,
      adjustmentMovement: 0,
      adjustmentMovementBase: 0,
      movementCount: 0
    };
  }

  private line(
    section: CashFlowSection,
    lineType: CashFlowLine["lineType"],
    label: string,
    pair: NumericPair,
    hasMultipleCurrencies: boolean
  ): CashFlowLine {
    return {
      section,
      sectionLabel: this.sectionLabel(section),
      lineType,
      label,
      amount: hasMultipleCurrencies ? null : pair.amount,
      baseAmount: pair.baseAmount,
      hasMultipleCurrencies
    };
  }

  private sectionLabel(section: CashFlowSection) {
    const labels: Record<CashFlowSection, string> = {
      OPERATING: "Actividades de operacion",
      INVESTING: "Actividades de inversion",
      FINANCING: "Actividades de financiamiento"
    };

    return labels[section];
  }

  private sectionTotal(lines: CashFlowLine[], section: CashFlowSection): NumericPair {
    return lines
      .filter((line) => line.section === section)
      .reduce(
        (sum, line) => ({
          amount: sum.amount + this.number(line.amount),
          baseAmount: sum.baseAmount + line.baseAmount
        }),
        { amount: 0, baseAmount: 0 }
      );
  }

  private pair(amount: number | null | undefined, baseAmount: number | null | undefined): NumericPair {
    return { amount: this.number(amount), baseAmount: this.number(baseAmount) };
  }

  private sumPair(rows: FlowRow[], amountKey: keyof FlowRow, baseKey: keyof FlowRow): NumericPair {
    return rows.reduce(
      (sum, row) => ({
        amount: sum.amount + this.number(row[amountKey] as number),
        baseAmount: sum.baseAmount + this.number(row[baseKey] as number)
      }),
      { amount: 0, baseAmount: 0 }
    );
  }

  private negate(pair: NumericPair): NumericPair {
    return { amount: -pair.amount, baseAmount: -pair.baseAmount };
  }

  private positiveOnly(pair: NumericPair): NumericPair {
    return {
      amount: pair.amount > 0 ? pair.amount : 0,
      baseAmount: pair.baseAmount > 0 ? pair.baseAmount : 0
    };
  }

  private negativeOnly(pair: NumericPair): NumericPair {
    return {
      amount: pair.amount < 0 ? pair.amount : 0,
      baseAmount: pair.baseAmount < 0 ? pair.baseAmount : 0
    };
  }

  private hasComparison(query: CashFlowQuery) {
    return Boolean(query.compareDateFrom || query.compareDateTo);
  }

  private number(value: number | null | undefined) {
    return Number(value ?? 0);
  }
}

export const cashFlowRepository = new CashFlowRepository();
