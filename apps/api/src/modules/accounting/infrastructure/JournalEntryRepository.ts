import { createHash, randomUUID } from "node:crypto";
import sql from "mssql";

import { ConflictError, NotFoundError, ValidationError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  JournalEntryCreatePayload,
  JournalEntryLinePayload,
  JournalEntryListQuery,
  JournalEntryPostPayload,
  JournalEntryUpdatePayload
} from "../validators/journal-entry.validators.js";

export type JournalEntryContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type JournalEntrySummary = {
  journalEntryId: string;
  tenantId: string;
  companyId: string;
  entryNumber: string;
  entryDate: Date;
  accountingPeriodId: string;
  periodCode: string;
  description: string;
  reference?: string;
  sourceModule: string;
  sourceDocumentType?: string;
  sourceDocumentId?: string;
  status: "DRAFT" | "POSTED";
  currencyCode: string;
  exchangeRate: number;
  totalDebit: number;
  totalCredit: number;
  totalDebitBase: number;
  totalCreditBase: number;
  difference: number;
  baseDifference: number;
  lineCount: number;
  postedAt?: Date;
  postedBy?: string;
  createdAt: Date;
  updatedAt?: Date;
};

export type JournalEntryLineSummary = {
  journalEntryLineId: string;
  journalEntryId: string;
  entryNumber: string;
  lineNumber: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  costCenterId?: string;
  costCenterCode?: string;
  costCenterName?: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  currencyCode: string;
  exchangeRate: number;
  debitBaseAmount: number;
  creditBaseAmount: number;
  reference?: string;
  createdAt: Date;
  updatedAt?: Date;
};

export type JournalEntryDetail = JournalEntrySummary & {
  lines: JournalEntryLineSummary[];
  canEdit: boolean;
  canPost: boolean;
  isBalanced: boolean;
  postedNow?: boolean;
};

type CountRow = { totalItems: number };
type IdRow = { id: string };
type LockedEntryRow = {
  JournalEntryId: string;
  TenantId: string;
  CompanyId: string;
  AccountingPeriodId: string;
  EntryDate: Date;
  Status: "DRAFT" | "POSTED";
  CurrencyCode: string;
  ExchangeRate: number;
  TotalDebit: number;
  TotalCredit: number;
  TotalDebitBase: number;
  TotalCreditBase: number;
};
type PeriodRow = {
  AccountingPeriodId: string;
  Status: "OPEN" | "CLOSED";
  IsActive: boolean;
  StartDate: Date;
  EndDate: Date;
};
type AccountRow = {
  AccountId: string;
  Code: string;
  Name: string;
  AllowsPosting: boolean;
  RequiresCostCenter: boolean;
  IsBlocked: boolean;
  IsActive: boolean;
  ValidFrom?: Date | null;
  ValidTo?: Date | null;
  ChildCount: number;
};
type CostCenterRow = {
  CostCenterId: string;
  Code: string;
  Name: string;
  AllowsPosting: boolean;
  IsActive: boolean;
  ValidFrom?: Date | null;
  ValidTo?: Date | null;
};
type OperationRow = {
  JournalEntryId: string;
  RequestHash: string;
  ResultStatus: string;
  ResultTotalDebit: number;
  ResultTotalCredit: number;
};

export type JournalEntryCreateInput = JournalEntryContextInput & JournalEntryCreatePayload;
export type JournalEntryUpdateInput = JournalEntryContextInput & JournalEntryUpdatePayload;
export type JournalEntryLineInput = JournalEntryContextInput & JournalEntryLinePayload;

export class JournalEntryRepository extends BaseSqlRepository {
  async listEntries(context: JournalEntryContextInput, query: JournalEntryListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const offset = (page - 1) * pageSize;
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "Offset", value: offset },
      { name: "Limit", value: pageSize }
    ];
    const where = ["summary.tenantId = @TenantId", "summary.companyId = @CompanyId"];

    if (query.accountingPeriodId) {
      where.push("summary.accountingPeriodId = @AccountingPeriodId");
      parameters.push({ name: "AccountingPeriodId", value: query.accountingPeriodId });
    }
    if (query.fiscalYear) {
      where.push("period.FiscalYear = @FiscalYear");
      parameters.push({ name: "FiscalYear", value: query.fiscalYear });
    }
    if (query.periodNumber) {
      where.push("period.PeriodNumber = @PeriodNumber");
      parameters.push({ name: "PeriodNumber", value: query.periodNumber });
    }
    if (query.status) {
      where.push("summary.status = @Status");
      parameters.push({ name: "Status", value: query.status });
    }
    if (query.accountId) {
      where.push("EXISTS (SELECT 1 FROM accounting.JournalEntryLines line WHERE line.JournalEntryId = summary.journalEntryId AND line.AccountId = @AccountId)");
      parameters.push({ name: "AccountId", value: query.accountId });
    }
    if (query.costCenterId) {
      where.push("EXISTS (SELECT 1 FROM accounting.JournalEntryLines line WHERE line.JournalEntryId = summary.journalEntryId AND line.CostCenterId = @CostCenterId)");
      parameters.push({ name: "CostCenterId", value: query.costCenterId });
    }
    if (query.sourceModule) {
      where.push("summary.sourceModule = @SourceModule");
      parameters.push({ name: "SourceModule", value: query.sourceModule });
    }
    if (query.dateFrom) {
      where.push("summary.entryDate >= @DateFrom");
      parameters.push({ name: "DateFrom", value: query.dateFrom });
    }
    if (query.dateTo) {
      where.push("summary.entryDate <= @DateTo");
      parameters.push({ name: "DateTo", value: query.dateTo });
    }
    if (query.search) {
      where.push("(summary.entryNumber LIKE @Search OR summary.description LIKE @Search OR summary.reference LIKE @Search)");
      parameters.push({ name: "Search", value: `%${query.search}%` });
    }

    const whereSql = where.join(" AND ");
    const rows = await this.query<JournalEntrySummary>(
      `
        SELECT summary.*
        FROM accounting.V_JournalEntrySummary summary
        INNER JOIN accounting.AccountingPeriods period ON period.AccountingPeriodId = summary.accountingPeriodId
        WHERE ${whereSql}
        ORDER BY summary.entryDate DESC, summary.entryNumber DESC
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
      `,
      parameters
    );
    const count = await this.query<CountRow>(
      `
        SELECT COUNT(1) AS totalItems
        FROM accounting.V_JournalEntrySummary summary
        INNER JOIN accounting.AccountingPeriods period ON period.AccountingPeriodId = summary.accountingPeriodId
        WHERE ${whereSql};
      `,
      parameters.filter((parameter) => parameter.name !== "Offset" && parameter.name !== "Limit")
    );

    return {
      records: rows.map((row) => this.mapSummary(row)),
      totalItems: count[0]?.totalItems ?? 0,
      page,
      pageSize
    };
  }

  async getEntry(context: JournalEntryContextInput, journalEntryId: string) {
    const header = await this.getSummary(context, journalEntryId);
    const lines = await this.listLines(context, journalEntryId);
    return this.detail(header, lines);
  }

  async listLines(context: JournalEntryContextInput, journalEntryId: string) {
    await this.ensureEntryExists(context, journalEntryId);
    const rows = await this.query<JournalEntryLineSummary>(
      `
        SELECT *
        FROM accounting.V_JournalEntryLineSummary
        WHERE journalEntryId = @JournalEntryId
        ORDER BY lineNumber;
      `,
      [{ name: "JournalEntryId", value: journalEntryId }]
    );

    return rows.map((row) => this.mapLine(row));
  }

  async createEntry(input: JournalEntryCreateInput) {
    const id = await this.executeInTransaction(async (transaction) => {
      const period = await this.findOpenPeriod(transaction, input, input.entryDate, true);
      const entryNumber = await this.nextEntryNumber(transaction, input, input.entryDate);
      const journalEntryId = randomUUID();

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO accounting.JournalEntries (
            JournalEntryId, TenantId, CompanyId, EntryNumber, AccountingPeriodId, EntryDate,
            Description, Reference, SourceModule, Status, CurrencyCode, ExchangeRate, CreatedBy
          )
          VALUES (
            @JournalEntryId, @TenantId, @CompanyId, @EntryNumber, @AccountingPeriodId, @EntryDate,
            @Description, @Reference, N'MANUAL', N'DRAFT', @CurrencyCode, @ExchangeRate, @UserId
          );
        `,
        [
          { name: "JournalEntryId", value: journalEntryId },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "EntryNumber", value: entryNumber },
          { name: "AccountingPeriodId", value: period.AccountingPeriodId },
          { name: "EntryDate", value: input.entryDate },
          { name: "Description", value: input.description },
          { name: "Reference", value: input.reference ?? null },
          { name: "CurrencyCode", value: input.currencyCode },
          { name: "ExchangeRate", value: input.exchangeRate },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      return journalEntryId;
    });

    return this.getEntry(input, id);
  }

  async updateEntry(journalEntryId: string, input: JournalEntryUpdateInput) {
    const id = await this.executeInTransaction(async (transaction) => {
      const current = await this.lockEntry(transaction, input, journalEntryId);
      this.ensureDraft(current);
      const entryDate = input.entryDate ?? this.toDateInput(current.EntryDate);
      const period = input.entryDate
        ? await this.findOpenPeriod(transaction, input, input.entryDate, true)
        : await this.lockPeriod(transaction, input, current.AccountingPeriodId);
      this.ensureDateInsidePeriod(entryDate, period);

      const currencyCode = input.currencyCode ?? current.CurrencyCode;
      const exchangeRate = input.exchangeRate ?? Number(current.ExchangeRate);

      await this.queryInTransaction(
        transaction,
        `
          UPDATE accounting.JournalEntries
          SET
            AccountingPeriodId = @AccountingPeriodId,
            EntryDate = @EntryDate,
            Description = COALESCE(@Description, Description),
            Reference = @Reference,
            CurrencyCode = @CurrencyCode,
            ExchangeRate = @ExchangeRate,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
          WHERE JournalEntryId = @JournalEntryId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "JournalEntryId", value: journalEntryId },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "AccountingPeriodId", value: period.AccountingPeriodId },
          { name: "EntryDate", value: entryDate },
          { name: "Description", value: input.description ?? null },
          { name: "Reference", value: input.reference ?? null },
          { name: "CurrencyCode", value: currencyCode },
          { name: "ExchangeRate", value: exchangeRate },
          { name: "UserId", value: input.userId ?? null }
        ]
      );
      await this.recalculateLineBaseAmounts(transaction, input, journalEntryId, currencyCode, exchangeRate);
      await this.recalculateTotals(transaction, input, journalEntryId);

      return journalEntryId;
    });

    return this.getEntry(input, id);
  }

  async addLine(journalEntryId: string, input: JournalEntryLineInput) {
    const id = await this.executeInTransaction(async (transaction) => {
      const entry = await this.lockEntry(transaction, input, journalEntryId);
      this.ensureDraft(entry);
      const account = await this.validateAccount(transaction, input, input.accountId, entry.EntryDate);
      await this.validateCostCenter(transaction, input, input.costCenterId, account, entry.EntryDate);
      const lineNumber = await this.nextLineNumber(transaction, journalEntryId);
      const journalEntryLineId = randomUUID();

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO accounting.JournalEntryLines (
            JournalEntryLineId, JournalEntryId, TenantId, CompanyId, LineNumber, AccountId,
            AccountCodeSnapshot, AccountNameSnapshot, CostCenterId, Description, DebitAmount, CreditAmount,
            CurrencyCode, ExchangeRate, DebitBaseAmount, CreditBaseAmount, Reference, CreatedBy
          )
          VALUES (
            @JournalEntryLineId, @JournalEntryId, @TenantId, @CompanyId, @LineNumber, @AccountId,
            @AccountCodeSnapshot, @AccountNameSnapshot, @CostCenterId, @Description, @DebitAmount, @CreditAmount,
            @CurrencyCode, @ExchangeRate, ROUND(@DebitAmount * @ExchangeRate, 4), ROUND(@CreditAmount * @ExchangeRate, 4),
            @Reference, @UserId
          );
        `,
        this.lineParameters(journalEntryLineId, journalEntryId, lineNumber, input, entry, account)
      );
      await this.recalculateTotals(transaction, input, journalEntryId);

      return journalEntryId;
    });

    return this.getEntry(input, id);
  }

  async updateLine(journalEntryId: string, lineId: string, input: JournalEntryLineInput) {
    const id = await this.executeInTransaction(async (transaction) => {
      const entry = await this.lockEntry(transaction, input, journalEntryId);
      this.ensureDraft(entry);
      await this.lockLine(transaction, input, journalEntryId, lineId);
      const account = await this.validateAccount(transaction, input, input.accountId, entry.EntryDate);
      await this.validateCostCenter(transaction, input, input.costCenterId, account, entry.EntryDate);

      await this.queryInTransaction(
        transaction,
        `
          UPDATE accounting.JournalEntryLines
          SET
            AccountId = @AccountId,
            AccountCodeSnapshot = @AccountCodeSnapshot,
            AccountNameSnapshot = @AccountNameSnapshot,
            CostCenterId = @CostCenterId,
            Description = @Description,
            DebitAmount = @DebitAmount,
            CreditAmount = @CreditAmount,
            CurrencyCode = @CurrencyCode,
            ExchangeRate = @ExchangeRate,
            DebitBaseAmount = ROUND(@DebitAmount * @ExchangeRate, 4),
            CreditBaseAmount = ROUND(@CreditAmount * @ExchangeRate, 4),
            Reference = @Reference,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
          WHERE JournalEntryLineId = @JournalEntryLineId
            AND JournalEntryId = @JournalEntryId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        this.lineParameters(lineId, journalEntryId, 0, input, entry, account)
      );
      await this.recalculateTotals(transaction, input, journalEntryId);

      return journalEntryId;
    });

    return this.getEntry(input, id);
  }

  async deleteLine(context: JournalEntryContextInput, journalEntryId: string, lineId: string) {
    const id = await this.executeInTransaction(async (transaction) => {
      const entry = await this.lockEntry(transaction, context, journalEntryId);
      this.ensureDraft(entry);
      await this.lockLine(transaction, context, journalEntryId, lineId);
      await this.queryInTransaction(
        transaction,
        `
          DELETE FROM accounting.JournalEntryLines
          WHERE JournalEntryLineId = @JournalEntryLineId
            AND JournalEntryId = @JournalEntryId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "JournalEntryLineId", value: lineId },
          { name: "JournalEntryId", value: journalEntryId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );
      await this.recalculateTotals(transaction, context, journalEntryId);

      return journalEntryId;
    });

    return this.getEntry(context, id);
  }

  async postEntry(context: JournalEntryContextInput, journalEntryId: string, payload: JournalEntryPostPayload) {
    const result = await this.executeInTransaction(async (transaction) => {
      const requestHash = this.requestHash(payload);
      const operation = await this.lockOperation(transaction, context, payload.idempotencyKey);

      if (operation) {
        if (operation.JournalEntryId.toLowerCase() !== journalEntryId.toLowerCase() || operation.RequestHash !== requestHash) {
          throw new ConflictError(
            "Idempotency key was already used with a different journal entry post payload.",
            { journalEntryId, idempotencyKey: payload.idempotencyKey },
            "JOURNAL_ENTRY_IDEMPOTENCY_CONFLICT"
          );
        }

        return { journalEntryId, postedNow: false };
      }

      const entry = await this.lockEntry(transaction, context, journalEntryId);
      const operationAfterEntryLock = await this.lockOperation(transaction, context, payload.idempotencyKey);
      if (operationAfterEntryLock) {
        if (
          operationAfterEntryLock.JournalEntryId.toLowerCase() !== journalEntryId.toLowerCase() ||
          operationAfterEntryLock.RequestHash !== requestHash
        ) {
          throw new ConflictError(
            "Idempotency key was already used with a different journal entry post payload.",
            { journalEntryId, idempotencyKey: payload.idempotencyKey },
            "JOURNAL_ENTRY_IDEMPOTENCY_CONFLICT"
          );
        }

        return { journalEntryId, postedNow: false };
      }

      if (entry.Status !== "DRAFT") {
        throw new ConflictError(
          "Only DRAFT journal entries can be posted with a new idempotency key.",
          { journalEntryId, status: entry.Status },
          "JOURNAL_ENTRY_NOT_DRAFT"
        );
      }

      const period = await this.lockPeriod(transaction, context, entry.AccountingPeriodId);
      if (period.Status !== "OPEN" || !period.IsActive) {
        throw new ConflictError(
          "Journal entry period is no longer OPEN.",
          { journalEntryId, accountingPeriodId: entry.AccountingPeriodId },
          "JOURNAL_ENTRY_PERIOD_NOT_OPEN"
        );
      }
      this.ensureDateInsidePeriod(this.toDateInput(entry.EntryDate), period);

      const lines = await this.lockLines(transaction, context, journalEntryId);
      if (lines.length < 2) {
        throw new ConflictError("Journal entry requires at least two lines.", { journalEntryId }, "JOURNAL_ENTRY_LINES_REQUIRED");
      }
      if (Number(entry.TotalDebit) <= 0 || Number(entry.TotalCredit) <= 0) {
        throw new ConflictError("Journal entry totals must be greater than zero.", { journalEntryId }, "JOURNAL_ENTRY_EMPTY_TOTALS");
      }
      if (!this.amountsMatch(entry.TotalDebit, entry.TotalCredit) || !this.amountsMatch(entry.TotalDebitBase, entry.TotalCreditBase)) {
        throw new ConflictError(
          "Journal entry must be balanced before posting.",
          { journalEntryId, totalDebit: entry.TotalDebit, totalCredit: entry.TotalCredit },
          "JOURNAL_ENTRY_NOT_BALANCED"
        );
      }

      for (const line of lines) {
        const account = await this.validateAccount(transaction, context, line.accountId, entry.EntryDate);
        await this.validateCostCenter(transaction, context, line.costCenterId, account, entry.EntryDate);
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE accounting.JournalEntries
          SET Status = N'POSTED',
              PostedAt = SYSUTCDATETIME(),
              PostedBy = @UserId,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE JournalEntryId = @JournalEntryId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND Status = N'DRAFT';
        `,
        [
          { name: "JournalEntryId", value: journalEntryId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO accounting.JournalEntryOperations (
            JournalEntryOperationId, TenantId, CompanyId, JournalEntryId, OperationType,
            IdempotencyKey, RequestHash, ResultStatus, ResultTotalDebit, ResultTotalCredit, CreatedBy
          )
          VALUES (
            @JournalEntryOperationId, @TenantId, @CompanyId, @JournalEntryId, N'POST',
            @IdempotencyKey, @RequestHash, N'POSTED', @ResultTotalDebit, @ResultTotalCredit, @UserId
          );
        `,
        [
          { name: "JournalEntryOperationId", value: randomUUID() },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "JournalEntryId", value: journalEntryId },
          { name: "IdempotencyKey", value: payload.idempotencyKey },
          { name: "RequestHash", value: requestHash },
          { name: "ResultTotalDebit", value: entry.TotalDebit },
          { name: "ResultTotalCredit", value: entry.TotalCredit },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      return { journalEntryId, postedNow: true };
    });

    const detail = await this.getEntry(context, result.journalEntryId);
    return { ...detail, postedNow: result.postedNow };
  }

  async countPostOperations(context: JournalEntryContextInput, journalEntryId: string) {
    const rows = await this.query<{ totalItems: number }>(
      `
        SELECT COUNT(1) AS totalItems
        FROM accounting.JournalEntryOperations
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND JournalEntryId = @JournalEntryId
          AND OperationType = N'POST';
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "JournalEntryId", value: journalEntryId }
      ]
    );

    return rows[0]?.totalItems ?? 0;
  }

  private async ensureEntryExists(context: JournalEntryContextInput, journalEntryId: string) {
    await this.getSummary(context, journalEntryId);
  }

  private async getSummary(context: JournalEntryContextInput, journalEntryId: string) {
    const rows = await this.query<JournalEntrySummary>(
      `
        SELECT *
        FROM accounting.V_JournalEntrySummary
        WHERE tenantId = @TenantId
          AND companyId = @CompanyId
          AND journalEntryId = @JournalEntryId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "JournalEntryId", value: journalEntryId }
      ]
    );
    if (!rows[0]) {
      throw new NotFoundError("Journal entry not found.", { journalEntryId }, "JOURNAL_ENTRY_NOT_FOUND");
    }

    return this.mapSummary(rows[0]);
  }

  private detail(header: JournalEntrySummary, lines: JournalEntryLineSummary[]): JournalEntryDetail {
    const isBalanced = this.amountsMatch(header.totalDebit, header.totalCredit) && this.amountsMatch(header.totalDebitBase, header.totalCreditBase);
    const canEdit = header.status === "DRAFT";
    const canPost = canEdit && lines.length >= 2 && header.totalDebit > 0 && header.totalCredit > 0 && isBalanced;

    return { ...header, lines, canEdit, canPost, isBalanced };
  }

  private async lockEntry(transaction: sql.Transaction, context: JournalEntryContextInput, journalEntryId: string) {
    const rows = await this.queryInTransaction<LockedEntryRow>(
      transaction,
      `
        SELECT *
        FROM accounting.JournalEntries WITH (UPDLOCK, HOLDLOCK)
        WHERE JournalEntryId = @JournalEntryId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "JournalEntryId", value: journalEntryId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );
    if (!rows[0]) {
      throw new NotFoundError("Journal entry not found.", { journalEntryId }, "JOURNAL_ENTRY_NOT_FOUND");
    }

    return rows[0];
  }

  private async lockLine(transaction: sql.Transaction, context: JournalEntryContextInput, journalEntryId: string, lineId: string) {
    const rows = await this.queryInTransaction<IdRow>(
      transaction,
      `
        SELECT JournalEntryLineId AS id
        FROM accounting.JournalEntryLines WITH (UPDLOCK, HOLDLOCK)
        WHERE JournalEntryLineId = @JournalEntryLineId
          AND JournalEntryId = @JournalEntryId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "JournalEntryLineId", value: lineId },
        { name: "JournalEntryId", value: journalEntryId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );
    if (!rows[0]) {
      throw new NotFoundError("Journal entry line not found.", { lineId }, "JOURNAL_ENTRY_LINE_NOT_FOUND");
    }
  }

  private async lockLines(transaction: sql.Transaction, context: JournalEntryContextInput, journalEntryId: string) {
    const rows = await this.queryInTransaction<JournalEntryLineSummary>(
      transaction,
      `
        SELECT viewLine.*
        FROM accounting.JournalEntryLines line WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN accounting.V_JournalEntryLineSummary viewLine ON viewLine.journalEntryLineId = line.JournalEntryLineId
        WHERE line.JournalEntryId = @JournalEntryId
          AND line.TenantId = @TenantId
          AND line.CompanyId = @CompanyId
        ORDER BY line.LineNumber;
      `,
      [
        { name: "JournalEntryId", value: journalEntryId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    return rows.map((row) => this.mapLine(row));
  }

  private async lockOperation(transaction: sql.Transaction, context: JournalEntryContextInput, idempotencyKey: string) {
    const rows = await this.queryInTransaction<OperationRow>(
      transaction,
      `
        SELECT JournalEntryId, RequestHash, ResultStatus, ResultTotalDebit, ResultTotalCredit
        FROM accounting.JournalEntryOperations WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND OperationType = N'POST'
          AND IdempotencyKey = @IdempotencyKey;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "IdempotencyKey", value: idempotencyKey }
      ]
    );

    return rows[0];
  }

  private async lockPeriod(transaction: sql.Transaction, context: JournalEntryContextInput, accountingPeriodId: string) {
    const rows = await this.queryInTransaction<PeriodRow>(
      transaction,
      `
        SELECT AccountingPeriodId, Status, IsActive, StartDate, EndDate
        FROM accounting.AccountingPeriods WITH (UPDLOCK, HOLDLOCK)
        WHERE AccountingPeriodId = @AccountingPeriodId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "AccountingPeriodId", value: accountingPeriodId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );
    if (!rows[0]) {
      throw new NotFoundError("Accounting period not found.", { accountingPeriodId }, "ACCOUNTING_PERIOD_NOT_FOUND");
    }

    return rows[0];
  }

  private async findOpenPeriod(transaction: sql.Transaction, context: JournalEntryContextInput, entryDate: string, lock: boolean) {
    const rows = await this.queryInTransaction<PeriodRow>(
      transaction,
      `
        SELECT AccountingPeriodId, Status, IsActive, StartDate, EndDate
        FROM accounting.AccountingPeriods ${lock ? "WITH (UPDLOCK, HOLDLOCK)" : ""}
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND IsActive = 1
          AND Status = N'OPEN'
          AND @EntryDate BETWEEN StartDate AND EndDate;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "EntryDate", value: entryDate }
      ]
    );

    if (rows.length === 0) {
      throw new ValidationError("No OPEN accounting period contains the journal entry date.", { entryDate }, "JOURNAL_ENTRY_PERIOD_REQUIRED");
    }
    if (rows.length > 1) {
      throw new ConflictError("Multiple OPEN accounting periods contain the journal entry date.", { entryDate }, "JOURNAL_ENTRY_PERIOD_OVERLAP");
    }

    return rows[0]!;
  }

  private async validateAccount(transaction: sql.Transaction, context: JournalEntryContextInput, accountId: string, entryDate: Date | string) {
    const rows = await this.queryInTransaction<AccountRow>(
      transaction,
      `
        SELECT
          account.AccountId,
          account.Code,
          account.Name,
          account.AllowsPosting,
          account.RequiresCostCenter,
          account.IsBlocked,
          account.IsActive,
          account.ValidFrom,
          account.ValidTo,
          (SELECT COUNT(1) FROM accounting.Accounts child WITH (UPDLOCK, HOLDLOCK)
           WHERE child.ParentAccountId = account.AccountId AND child.TenantId = account.TenantId AND child.CompanyId = account.CompanyId AND child.IsActive = 1) AS ChildCount
        FROM accounting.Accounts account WITH (UPDLOCK, HOLDLOCK)
        WHERE account.AccountId = @AccountId
          AND account.TenantId = @TenantId
          AND account.CompanyId = @CompanyId;
      `,
      [
        { name: "AccountId", value: accountId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );
    const account = rows[0];
    if (!account) {
      throw new ValidationError("Accounting account is not available for this company.", { accountId }, "JOURNAL_ENTRY_ACCOUNT_INVALID");
    }
    if (!account.IsActive) {
      throw new ConflictError("Accounting account is inactive.", { accountId }, "JOURNAL_ENTRY_ACCOUNT_INACTIVE");
    }
    if (account.IsBlocked) {
      throw new ConflictError("Accounting account is blocked.", { accountId }, "JOURNAL_ENTRY_ACCOUNT_BLOCKED");
    }
    if (!account.AllowsPosting || account.ChildCount > 0) {
      throw new ConflictError("Accounting account does not allow posting.", { accountId }, "JOURNAL_ENTRY_ACCOUNT_NOT_POSTABLE");
    }
    this.ensureValidOnDate("account", accountId, account.ValidFrom, account.ValidTo, entryDate);

    return account;
  }

  private async validateCostCenter(
    transaction: sql.Transaction,
    context: JournalEntryContextInput,
    costCenterId: string | undefined,
    account: AccountRow,
    entryDate: Date | string
  ) {
    if (account.RequiresCostCenter && !costCenterId) {
      throw new ValidationError(
        "Cost center is required by the selected account.",
        { accountId: account.AccountId },
        "JOURNAL_ENTRY_COST_CENTER_REQUIRED"
      );
    }
    if (!costCenterId) {
      return null;
    }

    const rows = await this.queryInTransaction<CostCenterRow>(
      transaction,
      `
        SELECT CostCenterId, Code, Name, AllowsPosting, IsActive, ValidFrom, ValidTo
        FROM accounting.CostCenters WITH (UPDLOCK, HOLDLOCK)
        WHERE CostCenterId = @CostCenterId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "CostCenterId", value: costCenterId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );
    const costCenter = rows[0];
    if (!costCenter) {
      throw new ValidationError("Cost center is not available for this company.", { costCenterId }, "JOURNAL_ENTRY_COST_CENTER_INVALID");
    }
    if (!costCenter.IsActive) {
      throw new ConflictError("Cost center is inactive.", { costCenterId }, "JOURNAL_ENTRY_COST_CENTER_INACTIVE");
    }
    if (!costCenter.AllowsPosting) {
      throw new ConflictError("Cost center does not allow posting.", { costCenterId }, "JOURNAL_ENTRY_COST_CENTER_NOT_POSTABLE");
    }
    this.ensureValidOnDate("costCenter", costCenterId, costCenter.ValidFrom, costCenter.ValidTo, entryDate);

    return costCenter;
  }

  private async nextEntryNumber(transaction: sql.Transaction, context: JournalEntryContextInput, entryDate: string) {
    const date = new Date(`${entryDate}T00:00:00.000Z`);
    const prefix = `ASI-${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const rows = await this.queryInTransaction<{ lastNumber: number | null }>(
      transaction,
      `
        SELECT MAX(TRY_CONVERT(INT, RIGHT(EntryNumber, 4))) AS lastNumber
        FROM accounting.JournalEntries WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND EntryNumber LIKE @Prefix + N'-%';
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "Prefix", value: prefix }
      ]
    );
    const next = Number(rows[0]?.lastNumber ?? 0) + 1;
    return `${prefix}-${String(next).padStart(4, "0")}`;
  }

  private async nextLineNumber(transaction: sql.Transaction, journalEntryId: string) {
    const rows = await this.queryInTransaction<{ lineNumber: number }>(
      transaction,
      `
        SELECT COALESCE(MAX(LineNumber), 0) + 1 AS lineNumber
        FROM accounting.JournalEntryLines WITH (UPDLOCK, HOLDLOCK)
        WHERE JournalEntryId = @JournalEntryId;
      `,
      [{ name: "JournalEntryId", value: journalEntryId }]
    );

    return rows[0]?.lineNumber ?? 1;
  }

  private async recalculateLineBaseAmounts(
    transaction: sql.Transaction,
    context: JournalEntryContextInput,
    journalEntryId: string,
    currencyCode: string,
    exchangeRate: number
  ) {
    await this.queryInTransaction(
      transaction,
      `
        UPDATE accounting.JournalEntryLines
        SET CurrencyCode = @CurrencyCode,
            ExchangeRate = @ExchangeRate,
            DebitBaseAmount = ROUND(DebitAmount * @ExchangeRate, 4),
            CreditBaseAmount = ROUND(CreditAmount * @ExchangeRate, 4),
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        WHERE JournalEntryId = @JournalEntryId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "JournalEntryId", value: journalEntryId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "CurrencyCode", value: currencyCode },
        { name: "ExchangeRate", value: exchangeRate },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async recalculateTotals(transaction: sql.Transaction, context: JournalEntryContextInput, journalEntryId: string) {
    await this.queryInTransaction(
      transaction,
      `
        UPDATE entry
        SET TotalDebit = COALESCE(totals.TotalDebit, 0),
            TotalCredit = COALESCE(totals.TotalCredit, 0),
            TotalDebitBase = COALESCE(totals.TotalDebitBase, 0),
            TotalCreditBase = COALESCE(totals.TotalCreditBase, 0),
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        FROM accounting.JournalEntries entry
        OUTER APPLY (
            SELECT
              SUM(line.DebitAmount) AS TotalDebit,
              SUM(line.CreditAmount) AS TotalCredit,
              SUM(line.DebitBaseAmount) AS TotalDebitBase,
              SUM(line.CreditBaseAmount) AS TotalCreditBase
            FROM accounting.JournalEntryLines line
            WHERE line.JournalEntryId = entry.JournalEntryId
        ) totals
        WHERE entry.JournalEntryId = @JournalEntryId
          AND entry.TenantId = @TenantId
          AND entry.CompanyId = @CompanyId;
      `,
      [
        { name: "JournalEntryId", value: journalEntryId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private lineParameters(
    lineId: string,
    journalEntryId: string,
    lineNumber: number,
    input: JournalEntryLineInput,
    entry: LockedEntryRow,
    account: AccountRow
  ): SqlParameter[] {
    return [
      { name: "JournalEntryLineId", value: lineId },
      { name: "JournalEntryId", value: journalEntryId },
      { name: "TenantId", value: input.tenantId },
      { name: "CompanyId", value: input.companyId },
      { name: "LineNumber", value: lineNumber },
      { name: "AccountId", value: input.accountId },
      { name: "AccountCodeSnapshot", value: account.Code },
      { name: "AccountNameSnapshot", value: account.Name },
      { name: "CostCenterId", value: input.costCenterId ?? null },
      { name: "Description", value: input.description },
      { name: "DebitAmount", value: input.debitAmount },
      { name: "CreditAmount", value: input.creditAmount },
      { name: "CurrencyCode", value: entry.CurrencyCode },
      { name: "ExchangeRate", value: Number(entry.ExchangeRate) },
      { name: "Reference", value: input.reference ?? null },
      { name: "UserId", value: input.userId ?? null }
    ];
  }

  private ensureDraft(entry: LockedEntryRow) {
    if (entry.Status !== "DRAFT") {
      throw new ConflictError("Posted journal entries cannot be modified.", { status: entry.Status }, "JOURNAL_ENTRY_IMMUTABLE");
    }
  }

  private ensureDateInsidePeriod(entryDate: string, period: PeriodRow) {
    const date = new Date(`${entryDate}T00:00:00.000Z`).getTime();
    const start = new Date(period.StartDate).getTime();
    const end = new Date(period.EndDate).getTime();
    if (date < start || date > end) {
      throw new ConflictError(
        "Journal entry date no longer belongs to the accounting period.",
        { entryDate, accountingPeriodId: period.AccountingPeriodId },
        "JOURNAL_ENTRY_DATE_OUT_OF_PERIOD"
      );
    }
  }

  private ensureValidOnDate(entity: string, id: string, validFrom: Date | null | undefined, validTo: Date | null | undefined, entryDate: Date | string) {
    const date = new Date(`${this.toDateInput(entryDate)}T00:00:00.000Z`).getTime();
    if (validFrom && date < new Date(validFrom).getTime()) {
      throw new ConflictError(`${entity} is not valid yet.`, { id, entryDate }, "JOURNAL_ENTRY_REFERENCE_NOT_VALID");
    }
    if (validTo && date > new Date(validTo).getTime()) {
      throw new ConflictError(`${entity} is no longer valid.`, { id, entryDate }, "JOURNAL_ENTRY_REFERENCE_EXPIRED");
    }
  }

  private requestHash(payload: JournalEntryPostPayload) {
    return createHash("sha256")
      .update(JSON.stringify({ idempotencyKey: payload.idempotencyKey, requestHash: payload.requestHash ?? null }))
      .digest("hex");
  }

  private amountsMatch(left: number, right: number) {
    return Math.abs(Number(left) - Number(right)) < 0.0001;
  }

  private toDateInput(value: Date | string) {
    if (typeof value === "string") {
      return value.slice(0, 10);
    }

    return value.toISOString().slice(0, 10);
  }

  private mapSummary(row: JournalEntrySummary): JournalEntrySummary {
    return {
      ...row,
      reference: row.reference ?? undefined,
      sourceDocumentType: row.sourceDocumentType ?? undefined,
      sourceDocumentId: row.sourceDocumentId ?? undefined,
      postedBy: row.postedBy ?? undefined,
      postedAt: row.postedAt ?? undefined,
      updatedAt: row.updatedAt ?? undefined,
      exchangeRate: Number(row.exchangeRate),
      totalDebit: Number(row.totalDebit),
      totalCredit: Number(row.totalCredit),
      totalDebitBase: Number(row.totalDebitBase),
      totalCreditBase: Number(row.totalCreditBase),
      difference: Number(row.difference),
      baseDifference: Number(row.baseDifference),
      lineCount: Number(row.lineCount)
    };
  }

  private mapLine(row: JournalEntryLineSummary): JournalEntryLineSummary {
    return {
      ...row,
      costCenterId: row.costCenterId ?? undefined,
      costCenterCode: row.costCenterCode ?? undefined,
      costCenterName: row.costCenterName ?? undefined,
      reference: row.reference ?? undefined,
      updatedAt: row.updatedAt ?? undefined,
      debitAmount: Number(row.debitAmount),
      creditAmount: Number(row.creditAmount),
      exchangeRate: Number(row.exchangeRate),
      debitBaseAmount: Number(row.debitBaseAmount),
      creditBaseAmount: Number(row.creditBaseAmount)
    };
  }

  private async queryInTransaction<TRecord>(
    transaction: sql.Transaction,
    sqlText: string,
    parameters: readonly SqlParameter[] = []
  ): Promise<TRecord[]> {
    const request = new sql.Request(transaction);
    for (const parameter of parameters) {
      request.input(parameter.name, parameter.value);
    }
    const result = await request.query<TRecord>(sqlText);
    return result.recordset;
  }
}

export const journalEntryRepository = new JournalEntryRepository();
