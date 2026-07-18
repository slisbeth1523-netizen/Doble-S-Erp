import { NotFoundError, ValidationError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type { GeneralLedgerQuery } from "../validators/general-ledger.validators.js";

export type GeneralLedgerContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type GeneralLedgerEntry = {
  tenantId: string;
  companyId: string;
  journalEntryId: string;
  journalEntryLineId: string;
  entryNumber: string;
  entryDate: Date;
  accountingPeriodId: string;
  fiscalYear: number;
  periodNumber: number;
  periodCode: string;
  sourceModule: string;
  sourceDocumentType?: string;
  sourceDocumentId?: string;
  headerDescription: string;
  headerReference?: string;
  lineNumber: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  currentAccountCode: string;
  currentAccountName: string;
  accountType: string;
  normalBalance: "DEBIT" | "CREDIT";
  costCenterId?: string;
  costCenterCode?: string;
  costCenterName?: string;
  lineDescription: string;
  lineReference?: string;
  currencyCode: string;
  exchangeRate: number;
  debitAmount: number;
  creditAmount: number;
  debitBaseAmount: number;
  creditBaseAmount: number;
  signedAmount: number;
  signedBaseAmount: number;
  runningBalance: number;
  runningBaseBalance: number;
  postedAt: Date;
  postedBy?: string;
  createdAt: Date;
};

export type GeneralLedgerSummary = {
  openingBalance: number | null;
  openingBaseBalance: number;
  totalDebit: number | null;
  totalCredit: number | null;
  totalDebitBase: number;
  totalCreditBase: number;
  netMovement: number | null;
  netBaseMovement: number;
  closingBalance: number | null;
  closingBaseBalance: number;
  movementCount: number;
  hasMultipleCurrencies: boolean;
  currencyTotals: GeneralLedgerCurrencyTotal[];
};

export type GeneralLedgerCurrencyTotal = {
  currencyCode: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  netMovement: number;
  closingBalance: number;
  movementCount: number;
};

export type GeneralLedgerAccountSummary = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  normalBalance: "DEBIT" | "CREDIT";
  totalDebit: number;
  totalCredit: number;
  totalDebitBase: number;
  totalCreditBase: number;
  netMovement: number;
  netBaseMovement: number;
  movementCount: number;
  firstMovementDate?: Date;
  lastMovementDate?: Date;
};

export type GeneralLedgerPeriodSummary = GeneralLedgerAccountSummary & {
  accountingPeriodId: string;
  fiscalYear: number;
  periodNumber: number;
  periodCode: string;
  costCenterId?: string;
  costCenterCode?: string;
  costCenterName?: string;
};

type CountRow = { totalItems: number };
type SummaryRow = {
  totalDebit: number | null;
  totalCredit: number | null;
  totalDebitBase: number | null;
  totalCreditBase: number | null;
  netMovement: number | null;
  netBaseMovement: number | null;
  movementCount: number;
};
type BalanceRow = { balance: number | null; baseBalance: number | null };
type CurrencyTotalRow = GeneralLedgerCurrencyTotal;
type ExistsRow = { id: string };

export class GeneralLedgerRepository extends BaseSqlRepository {
  async listEntries(context: GeneralLedgerContextInput, query: GeneralLedgerQuery, options: { requireAccount?: boolean } = {}) {
    if (options.requireAccount !== false && !query.accountId) {
      throw new ValidationError("accountId is required for general ledger detail.", {
        code: "GENERAL_LEDGER_ACCOUNT_REQUIRED"
      });
    }
    await this.validateReferences(context, query);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const offset = (page - 1) * pageSize;
    const baseParameters = this.parameters(context, query);
    const filteredWhere = this.whereClause(query, "ledger", { includeDateRange: true });
    const opening = await this.getOpeningBalance(context, query);

    const rows = await this.query<GeneralLedgerEntry>(
      `
        WITH Filtered AS (
          SELECT ledger.*
          FROM accounting.V_GeneralLedgerEntries ledger
          WHERE ${filteredWhere}
        ),
        Running AS (
          SELECT
            Filtered.*,
            @OpeningBalance + SUM(Filtered.signedAmount) OVER (
              ORDER BY Filtered.entryDate, Filtered.postedAt, Filtered.entryNumber, Filtered.lineNumber, Filtered.journalEntryLineId
              ROWS UNBOUNDED PRECEDING
            ) AS runningBalance,
            @OpeningBaseBalance + SUM(Filtered.signedBaseAmount) OVER (
              ORDER BY Filtered.entryDate, Filtered.postedAt, Filtered.entryNumber, Filtered.lineNumber, Filtered.journalEntryLineId
              ROWS UNBOUNDED PRECEDING
            ) AS runningBaseBalance
          FROM Filtered
        )
        SELECT *
        FROM Running
        ORDER BY entryDate, postedAt, entryNumber, lineNumber, journalEntryLineId
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
      `,
      [
        ...baseParameters,
        { name: "OpeningBalance", value: opening.openingBalance },
        { name: "OpeningBaseBalance", value: opening.openingBaseBalance },
        { name: "Offset", value: offset },
        { name: "Limit", value: pageSize }
      ]
    );

    const countRows = await this.query<CountRow>(
      `
        SELECT COUNT(1) AS totalItems
        FROM accounting.V_GeneralLedgerEntries ledger
        WHERE ${filteredWhere};
      `,
      baseParameters
    );
    const summary = await this.getSummary(context, query);

    return {
      records: rows.map((row) => this.mapEntry(row)),
      totalItems: countRows[0]?.totalItems ?? 0,
      page,
      pageSize,
      summary
    };
  }

  async getSummary(context: GeneralLedgerContextInput, query: GeneralLedgerQuery): Promise<GeneralLedgerSummary> {
    await this.validateReferences(context, query);

    const baseParameters = this.parameters(context, query);
    const filteredWhere = this.whereClause(query, "ledger", { includeDateRange: true });
    const opening = await this.getOpeningBalance(context, query);
    const rows = await this.query<SummaryRow>(
      `
        SELECT
          COALESCE(SUM(ledger.debitAmount), 0) AS totalDebit,
          COALESCE(SUM(ledger.creditAmount), 0) AS totalCredit,
          COALESCE(SUM(ledger.debitBaseAmount), 0) AS totalDebitBase,
          COALESCE(SUM(ledger.creditBaseAmount), 0) AS totalCreditBase,
          COALESCE(SUM(ledger.signedAmount), 0) AS netMovement,
          COALESCE(SUM(ledger.signedBaseAmount), 0) AS netBaseMovement,
          COUNT(1) AS movementCount
        FROM accounting.V_GeneralLedgerEntries ledger
        WHERE ${filteredWhere};
      `,
      baseParameters
    );
    const currencyTotals = await this.getCurrencyTotals(context, query);
    const hasMultipleCurrencies = currencyTotals.length > 1;
    const row = rows[0];
    const netMovement = this.number(row?.netMovement);
    const netBaseMovement = this.number(row?.netBaseMovement);

    return {
      openingBalance: hasMultipleCurrencies ? null : opening.openingBalance,
      openingBaseBalance: opening.openingBaseBalance,
      totalDebit: hasMultipleCurrencies ? null : this.number(row?.totalDebit),
      totalCredit: hasMultipleCurrencies ? null : this.number(row?.totalCredit),
      totalDebitBase: this.number(row?.totalDebitBase),
      totalCreditBase: this.number(row?.totalCreditBase),
      netMovement: hasMultipleCurrencies ? null : netMovement,
      netBaseMovement,
      closingBalance: hasMultipleCurrencies ? null : opening.openingBalance + netMovement,
      closingBaseBalance: opening.openingBaseBalance + netBaseMovement,
      movementCount: row?.movementCount ?? 0,
      hasMultipleCurrencies,
      currencyTotals
    };
  }

  async listAccountSummaries(context: GeneralLedgerContextInput, query: GeneralLedgerQuery) {
    await this.validateReferences(context, query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const offset = (page - 1) * pageSize;
    const parameters = this.parameters(context, query);
    const whereSql = this.whereClause(query, "ledger", { includeDateRange: true });

    const rows = await this.query<GeneralLedgerAccountSummary>(
      `
        SELECT
          ledger.accountId,
          ledger.accountCode,
          ledger.accountName,
          ledger.accountType,
          ledger.normalBalance,
          SUM(ledger.debitAmount) AS totalDebit,
          SUM(ledger.creditAmount) AS totalCredit,
          SUM(ledger.debitBaseAmount) AS totalDebitBase,
          SUM(ledger.creditBaseAmount) AS totalCreditBase,
          SUM(ledger.signedAmount) AS netMovement,
          SUM(ledger.signedBaseAmount) AS netBaseMovement,
          COUNT(1) AS movementCount,
          MIN(ledger.entryDate) AS firstMovementDate,
          MAX(ledger.entryDate) AS lastMovementDate
        FROM accounting.V_GeneralLedgerEntries ledger
        WHERE ${whereSql}
        GROUP BY ledger.accountId, ledger.accountCode, ledger.accountName, ledger.accountType, ledger.normalBalance
        ORDER BY ledger.accountCode
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
      `,
      [...parameters, { name: "Offset", value: offset }, { name: "Limit", value: pageSize }]
    );
    const count = await this.query<CountRow>(
      `
        SELECT COUNT(1) AS totalItems
        FROM (
          SELECT ledger.accountId
          FROM accounting.V_GeneralLedgerEntries ledger
          WHERE ${whereSql}
          GROUP BY ledger.accountId
        ) grouped;
      `,
      parameters
    );

    return {
      records: rows.map((row) => this.mapAccountSummary(row)),
      totalItems: count[0]?.totalItems ?? 0,
      page,
      pageSize
    };
  }

  async listAccountPeriodSummaries(context: GeneralLedgerContextInput, accountId: string, query: GeneralLedgerQuery) {
    const nextQuery = { ...query, accountId };
    await this.validateReferences(context, nextQuery);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const offset = (page - 1) * pageSize;
    const parameters = this.parameters(context, nextQuery);
    const whereSql = this.periodSummaryWhereClause(nextQuery, "summary");

    const rows = await this.query<GeneralLedgerPeriodSummary>(
      `
        SELECT summary.*
        FROM accounting.V_GeneralLedgerAccountPeriodSummary summary
        WHERE ${whereSql}
        ORDER BY summary.fiscalYear, summary.periodNumber, summary.costCenterCode
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
      `,
      [...parameters, { name: "Offset", value: offset }, { name: "Limit", value: pageSize }]
    );
    const count = await this.query<CountRow>(
      `
        SELECT COUNT(1) AS totalItems
        FROM accounting.V_GeneralLedgerAccountPeriodSummary summary
        WHERE ${whereSql};
      `,
      parameters
    );

    return {
      records: rows.map((row) => this.mapPeriodSummary(row)),
      totalItems: count[0]?.totalItems ?? 0,
      page,
      pageSize
    };
  }

  async listCostCenterEntries(context: GeneralLedgerContextInput, costCenterId: string, query: GeneralLedgerQuery) {
    return this.listEntries(context, { ...query, costCenterId, accountId: query.accountId }, { requireAccount: false });
  }

  private async getOpeningBalance(context: GeneralLedgerContextInput, query: GeneralLedgerQuery) {
    if (!query.dateFrom) {
      return { openingBalance: 0, openingBaseBalance: 0 };
    }
    const parameters = this.parameters(context, query);
    const whereSql = this.whereClause(query, "ledger", { includeDateRange: false });
    const rows = await this.query<BalanceRow>(
      `
        SELECT
          COALESCE(SUM(ledger.signedAmount), 0) AS balance,
          COALESCE(SUM(ledger.signedBaseAmount), 0) AS baseBalance
        FROM accounting.V_GeneralLedgerEntries ledger
        WHERE ${whereSql}
          AND ledger.entryDate < @DateFrom;
      `,
      parameters
    );

    return {
      openingBalance: this.number(rows[0]?.balance),
      openingBaseBalance: this.number(rows[0]?.baseBalance)
    };
  }

  private async getCurrencyTotals(context: GeneralLedgerContextInput, query: GeneralLedgerQuery) {
    const parameters = this.parameters(context, query);
    const rangeWhereSql = this.whereClause(query, "ledger", { includeDateRange: true });
    const openingWhereSql = query.dateFrom
      ? `${this.whereClause(query, "ledger", { includeDateRange: false })} AND ledger.entryDate < @DateFrom`
      : "1 = 0";
    const rows = await this.query<CurrencyTotalRow>(
      `
        WITH Opening AS (
          SELECT
            ledger.currencyCode,
            COALESCE(SUM(ledger.signedAmount), 0) AS openingBalance
          FROM accounting.V_GeneralLedgerEntries ledger
          WHERE ${openingWhereSql}
          GROUP BY ledger.currencyCode
        ),
        Period AS (
          SELECT
            ledger.currencyCode,
            COALESCE(SUM(ledger.debitAmount), 0) AS totalDebit,
            COALESCE(SUM(ledger.creditAmount), 0) AS totalCredit,
            COALESCE(SUM(ledger.signedAmount), 0) AS netMovement,
            COUNT(1) AS movementCount
          FROM accounting.V_GeneralLedgerEntries ledger
          WHERE ${rangeWhereSql}
          GROUP BY ledger.currencyCode
        ),
        Currencies AS (
          SELECT currencyCode FROM Opening
          UNION
          SELECT currencyCode FROM Period
        )
        SELECT
          currencies.currencyCode,
          COALESCE(opening.openingBalance, 0) AS openingBalance,
          COALESCE(period.totalDebit, 0) AS totalDebit,
          COALESCE(period.totalCredit, 0) AS totalCredit,
          COALESCE(period.netMovement, 0) AS netMovement,
          COALESCE(opening.openingBalance, 0) + COALESCE(period.netMovement, 0) AS closingBalance,
          COALESCE(period.movementCount, 0) AS movementCount
        FROM Currencies currencies
        LEFT JOIN Opening opening ON opening.currencyCode = currencies.currencyCode
        LEFT JOIN Period period ON period.currencyCode = currencies.currencyCode
        ORDER BY currencies.currencyCode;
      `,
      parameters
    );

    return rows.map((row) => ({
      currencyCode: row.currencyCode,
      openingBalance: this.number(row.openingBalance),
      totalDebit: this.number(row.totalDebit),
      totalCredit: this.number(row.totalCredit),
      netMovement: this.number(row.netMovement),
      closingBalance: this.number(row.closingBalance),
      movementCount: row.movementCount
    }));
  }

  private parameters(context: GeneralLedgerContextInput, query: GeneralLedgerQuery): SqlParameter[] {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId }
    ];

    if (query.accountId) parameters.push({ name: "AccountId", value: query.accountId });
    if (query.accountingPeriodId) parameters.push({ name: "AccountingPeriodId", value: query.accountingPeriodId });
    if (query.fiscalYear) parameters.push({ name: "FiscalYear", value: query.fiscalYear });
    if (query.periodNumber) parameters.push({ name: "PeriodNumber", value: query.periodNumber });
    if (query.costCenterId) parameters.push({ name: "CostCenterId", value: query.costCenterId });
    if (query.sourceModule) parameters.push({ name: "SourceModule", value: query.sourceModule });
    if (query.sourceDocumentType) parameters.push({ name: "SourceDocumentType", value: query.sourceDocumentType });
    if (query.currencyCode) parameters.push({ name: "CurrencyCode", value: query.currencyCode });
    if (query.dateFrom) parameters.push({ name: "DateFrom", value: query.dateFrom });
    if (query.dateTo) parameters.push({ name: "DateTo", value: query.dateTo });
    if (query.search) parameters.push({ name: "Search", value: `%${query.search}%` });

    return parameters;
  }

  private whereClause(
    query: GeneralLedgerQuery,
    alias: string,
    options: { includeDateRange: boolean }
  ) {
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

  private periodSummaryWhereClause(query: GeneralLedgerQuery, alias: string) {
    const where = [`${alias}.tenantId = @TenantId`, `${alias}.companyId = @CompanyId`];

    if (query.accountId) where.push(`${alias}.accountId = @AccountId`);
    if (query.accountingPeriodId) where.push(`${alias}.accountingPeriodId = @AccountingPeriodId`);
    if (query.fiscalYear) where.push(`${alias}.fiscalYear = @FiscalYear`);
    if (query.periodNumber) where.push(`${alias}.periodNumber = @PeriodNumber`);
    if (query.costCenterId) where.push(`${alias}.costCenterId = @CostCenterId`);
    if (query.search) {
      where.push(`(
        ${alias}.accountCode LIKE @Search OR
        ${alias}.accountName LIKE @Search OR
        ${alias}.periodCode LIKE @Search OR
        ${alias}.costCenterCode LIKE @Search OR
        ${alias}.costCenterName LIKE @Search
      )`);
    }

    return where.join(" AND ");
  }

  private async validateReferences(context: GeneralLedgerContextInput, query: GeneralLedgerQuery) {
    if (query.accountId) {
      const rows = await this.query<ExistsRow>(
        `
          SELECT AccountId AS id
          FROM accounting.Accounts
          WHERE TenantId = @TenantId AND CompanyId = @CompanyId AND AccountId = @AccountId;
        `,
        [
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "AccountId", value: query.accountId }
        ]
      );
      if (!rows.length) throw new NotFoundError("Accounting account was not found.", { accountId: query.accountId });
    }

    if (query.costCenterId) {
      const rows = await this.query<ExistsRow>(
        `
          SELECT CostCenterId AS id
          FROM accounting.CostCenters
          WHERE TenantId = @TenantId AND CompanyId = @CompanyId AND CostCenterId = @CostCenterId;
        `,
        [
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "CostCenterId", value: query.costCenterId }
        ]
      );
      if (!rows.length) throw new NotFoundError("Cost center was not found.", { costCenterId: query.costCenterId });
    }

    if (query.accountingPeriodId) {
      const rows = await this.query<ExistsRow>(
        `
          SELECT AccountingPeriodId AS id
          FROM accounting.AccountingPeriods
          WHERE TenantId = @TenantId AND CompanyId = @CompanyId AND AccountingPeriodId = @AccountingPeriodId;
        `,
        [
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "AccountingPeriodId", value: query.accountingPeriodId }
        ]
      );
      if (!rows.length) {
        throw new NotFoundError("Accounting period was not found.", { accountingPeriodId: query.accountingPeriodId });
      }
    }
  }

  private mapEntry(row: GeneralLedgerEntry): GeneralLedgerEntry {
    return {
      ...row,
      debitAmount: this.number(row.debitAmount),
      creditAmount: this.number(row.creditAmount),
      debitBaseAmount: this.number(row.debitBaseAmount),
      creditBaseAmount: this.number(row.creditBaseAmount),
      signedAmount: this.number(row.signedAmount),
      signedBaseAmount: this.number(row.signedBaseAmount),
      runningBalance: this.number(row.runningBalance),
      runningBaseBalance: this.number(row.runningBaseBalance)
    };
  }

  private mapAccountSummary(row: GeneralLedgerAccountSummary): GeneralLedgerAccountSummary {
    return {
      ...row,
      totalDebit: this.number(row.totalDebit),
      totalCredit: this.number(row.totalCredit),
      totalDebitBase: this.number(row.totalDebitBase),
      totalCreditBase: this.number(row.totalCreditBase),
      netMovement: this.number(row.netMovement),
      netBaseMovement: this.number(row.netBaseMovement)
    };
  }

  private mapPeriodSummary(row: GeneralLedgerPeriodSummary): GeneralLedgerPeriodSummary {
    return this.mapAccountSummary(row) as GeneralLedgerPeriodSummary;
  }

  private number(value: number | null | undefined) {
    return Number(value ?? 0);
  }
}

export const generalLedgerRepository = new GeneralLedgerRepository();
