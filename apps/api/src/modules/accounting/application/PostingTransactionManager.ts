import { randomUUID } from "node:crypto";
import sql from "mssql";

import { ConflictError, NotFoundError, ValidationError } from "../../../errors/index.js";
import { getSqlServerPool } from "../../../db/sqlserver.js";
import type { SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import { postingRuleRepository } from "../infrastructure/PostingRuleRepository.js";
import type { JournalEntryDetail, JournalEntryLineSummary, JournalEntrySummary } from "../infrastructure/JournalEntryRepository.js";
import type { PostingContextInput } from "./AccountingPostingEngine.js";
import type { PostingPreview } from "./PostingPreviewService.js";

type PeriodRow = {
  AccountingPeriodId: string;
  Status: "OPEN" | "CLOSED";
  IsActive: boolean;
  StartDate: Date;
  EndDate: Date;
};

type IdRow = { id: string };

export class PostingTransactionManager {
  async createPosting(context: PostingContextInput, preview: PostingPreview) {
    const pool = await getSqlServerPool();
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      const existing = await this.findExistingPosting(transaction, context, preview.sourceModule, preview.sourceDocumentType, preview.documentId);
      if (existing) {
        await transaction.commit();
        return { ...(await this.getEntry(context, existing)), alreadyExists: true };
      }

      const period = await this.findOpenPeriod(transaction, context, preview.postingDate);
      const entryNumber = await this.nextEntryNumber(transaction, context, preview.postingDate);
      const journalEntryId = randomUUID();

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO accounting.JournalEntries (
            JournalEntryId, TenantId, CompanyId, EntryNumber, AccountingPeriodId, EntryDate,
            Description, Reference, SourceModule, SourceDocumentType, SourceDocumentId, Status,
            CurrencyCode, ExchangeRate, TotalDebit, TotalCredit, TotalDebitBase, TotalCreditBase, CreatedBy
          )
          VALUES (
            @JournalEntryId, @TenantId, @CompanyId, @EntryNumber, @AccountingPeriodId, @EntryDate,
            @Description, @Reference, @SourceModule, @SourceDocumentType, @SourceDocumentId, N'DRAFT',
            @CurrencyCode, @ExchangeRate, @TotalDebit, @TotalCredit, @TotalDebitBase, @TotalCreditBase, @UserId
          );
        `,
        [
          { name: "JournalEntryId", value: journalEntryId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "EntryNumber", value: entryNumber },
          { name: "AccountingPeriodId", value: period.AccountingPeriodId },
          { name: "EntryDate", value: preview.postingDate },
          { name: "Description", value: preview.description },
          { name: "Reference", value: preview.reference },
          { name: "SourceModule", value: preview.sourceModule },
          { name: "SourceDocumentType", value: preview.sourceDocumentType },
          { name: "SourceDocumentId", value: preview.documentId },
          { name: "CurrencyCode", value: preview.currencyCode },
          { name: "ExchangeRate", value: preview.exchangeRate },
          { name: "TotalDebit", value: preview.totalDebit },
          { name: "TotalCredit", value: preview.totalCredit },
          { name: "TotalDebitBase", value: preview.totalDebitBase },
          { name: "TotalCreditBase", value: preview.totalCreditBase },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      for (const line of preview.lines) {
        const account = await postingRuleRepository.validateAccountInTransaction(transaction, context, line.accountId, preview.postingDate);
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
              @CurrencyCode, @ExchangeRate, @DebitBaseAmount, @CreditBaseAmount, @Reference, @UserId
            );
          `,
          [
            { name: "JournalEntryLineId", value: randomUUID() },
            { name: "JournalEntryId", value: journalEntryId },
            { name: "TenantId", value: context.tenantId },
            { name: "CompanyId", value: context.companyId },
            { name: "LineNumber", value: line.lineNumber },
            { name: "AccountId", value: account.accountId },
            { name: "AccountCodeSnapshot", value: account.code },
            { name: "AccountNameSnapshot", value: account.name },
            { name: "CostCenterId", value: line.costCenterId ?? null },
            { name: "Description", value: line.description },
            { name: "DebitAmount", value: line.debitAmount },
            { name: "CreditAmount", value: line.creditAmount },
            { name: "CurrencyCode", value: line.currencyCode },
            { name: "ExchangeRate", value: line.exchangeRate },
            { name: "DebitBaseAmount", value: line.debitBaseAmount },
            { name: "CreditBaseAmount", value: line.creditBaseAmount },
            { name: "Reference", value: preview.reference },
            { name: "UserId", value: context.userId ?? null }
          ]
        );
      }

      await transaction.commit();
      return { ...(await this.getEntry(context, journalEntryId)), alreadyExists: false };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async createReversal(context: PostingContextInput, preview: PostingPreview) {
    const pool = await getSqlServerPool();
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      const originalId = await this.findExistingPosting(transaction, context, preview.sourceModule, preview.sourceDocumentType, preview.documentId);
      if (!originalId) {
        throw new NotFoundError("No automatic posting exists for this document.", preview, "POSTING_ORIGINAL_NOT_FOUND");
      }

      const existingReversal = await this.findExistingPosting(
        transaction,
        context,
        preview.sourceModule,
        `${preview.sourceDocumentType}_REVERSAL`,
        preview.documentId
      );
      if (existingReversal) {
        await transaction.commit();
        return { ...(await this.getEntry(context, existingReversal)), alreadyExists: true };
      }

      const original = await this.getEntryForUpdate(transaction, context, originalId);
      const originalLines = await this.getLinesForUpdate(transaction, context, originalId);
      if (originalLines.length < 2) {
        throw new ConflictError("Original posting has no reversible lines.", { originalId }, "POSTING_REVERSAL_LINES_REQUIRED");
      }

      const period = await this.findOpenPeriod(transaction, context, preview.postingDate);
      const entryNumber = await this.nextEntryNumber(transaction, context, preview.postingDate);
      const reversalId = randomUUID();

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO accounting.JournalEntries (
            JournalEntryId, TenantId, CompanyId, EntryNumber, AccountingPeriodId, EntryDate,
            Description, Reference, SourceModule, SourceDocumentType, SourceDocumentId, Status,
            CurrencyCode, ExchangeRate, TotalDebit, TotalCredit, TotalDebitBase, TotalCreditBase, CreatedBy
          )
          VALUES (
            @JournalEntryId, @TenantId, @CompanyId, @EntryNumber, @AccountingPeriodId, @EntryDate,
            @Description, @Reference, @SourceModule, @SourceDocumentType, @SourceDocumentId, N'DRAFT',
            @CurrencyCode, @ExchangeRate, @TotalDebit, @TotalCredit, @TotalDebitBase, @TotalCreditBase, @UserId
          );
        `,
        [
          { name: "JournalEntryId", value: reversalId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "EntryNumber", value: entryNumber },
          { name: "AccountingPeriodId", value: period.AccountingPeriodId },
          { name: "EntryDate", value: preview.postingDate },
          { name: "Description", value: `Reverso automatico - ${original.entryNumber}` },
          { name: "Reference", value: `REV-${original.entryNumber}` },
          { name: "SourceModule", value: preview.sourceModule },
          { name: "SourceDocumentType", value: `${preview.sourceDocumentType}_REVERSAL` },
          { name: "SourceDocumentId", value: preview.documentId },
          { name: "CurrencyCode", value: original.currencyCode },
          { name: "ExchangeRate", value: original.exchangeRate },
          { name: "TotalDebit", value: original.totalCredit },
          { name: "TotalCredit", value: original.totalDebit },
          { name: "TotalDebitBase", value: original.totalCreditBase },
          { name: "TotalCreditBase", value: original.totalDebitBase },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      for (const line of originalLines) {
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
              @CurrencyCode, @ExchangeRate, @DebitBaseAmount, @CreditBaseAmount, @Reference, @UserId
            );
          `,
          [
            { name: "JournalEntryLineId", value: randomUUID() },
            { name: "JournalEntryId", value: reversalId },
            { name: "TenantId", value: context.tenantId },
            { name: "CompanyId", value: context.companyId },
            { name: "LineNumber", value: line.lineNumber },
            { name: "AccountId", value: line.accountId },
            { name: "AccountCodeSnapshot", value: line.accountCode },
            { name: "AccountNameSnapshot", value: line.accountName },
            { name: "CostCenterId", value: line.costCenterId ?? null },
            { name: "Description", value: `Reverso - ${line.description}` },
            { name: "DebitAmount", value: line.creditAmount },
            { name: "CreditAmount", value: line.debitAmount },
            { name: "CurrencyCode", value: line.currencyCode },
            { name: "ExchangeRate", value: line.exchangeRate },
            { name: "DebitBaseAmount", value: line.creditBaseAmount },
            { name: "CreditBaseAmount", value: line.debitBaseAmount },
            { name: "Reference", value: `REV-${original.entryNumber}` },
            { name: "UserId", value: context.userId ?? null }
          ]
        );
      }

      await transaction.commit();
      return { ...(await this.getEntry(context, reversalId)), alreadyExists: false };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private async findExistingPosting(
    transaction: sql.Transaction,
    context: PostingContextInput,
    sourceModule: string,
    sourceDocumentType: string,
    documentId: string
  ) {
    const rows = await this.queryInTransaction<IdRow>(
      transaction,
      `
        SELECT TOP (1) JournalEntryId AS id
        FROM accounting.JournalEntries WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SourceModule = @SourceModule
          AND SourceDocumentType = @SourceDocumentType
          AND SourceDocumentId = @SourceDocumentId
          AND IsActive = 1
        ORDER BY CreatedAt DESC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SourceModule", value: sourceModule },
        { name: "SourceDocumentType", value: sourceDocumentType },
        { name: "SourceDocumentId", value: documentId }
      ]
    );

    return rows[0]?.id;
  }

  private async findOpenPeriod(transaction: sql.Transaction, context: PostingContextInput, entryDate: string) {
    const rows = await this.queryInTransaction<PeriodRow>(
      transaction,
      `
        SELECT AccountingPeriodId, Status, IsActive, StartDate, EndDate
        FROM accounting.AccountingPeriods WITH (UPDLOCK, HOLDLOCK)
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
      throw new ValidationError("No OPEN accounting period contains the posting date.", { entryDate }, "POSTING_PERIOD_REQUIRED");
    }
    if (rows.length > 1) {
      throw new ConflictError("Multiple OPEN accounting periods contain the posting date.", { entryDate }, "POSTING_PERIOD_OVERLAP");
    }

    return rows[0]!;
  }

  private async nextEntryNumber(transaction: sql.Transaction, context: PostingContextInput, entryDate: string) {
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
    return `${prefix}-${String(Number(rows[0]?.lastNumber ?? 0) + 1).padStart(4, "0")}`;
  }

  private async getEntryForUpdate(transaction: sql.Transaction, context: PostingContextInput, journalEntryId: string) {
    const rows = await this.queryInTransaction<JournalEntrySummary>(
      transaction,
      `
        SELECT summary.*
        FROM accounting.JournalEntries entry WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN accounting.V_JournalEntrySummary summary ON summary.journalEntryId = entry.JournalEntryId
        WHERE entry.TenantId = @TenantId
          AND entry.CompanyId = @CompanyId
          AND entry.JournalEntryId = @JournalEntryId;
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

  private async getLinesForUpdate(transaction: sql.Transaction, context: PostingContextInput, journalEntryId: string) {
    const rows = await this.queryInTransaction<JournalEntryLineSummary>(
      transaction,
      `
        SELECT viewLine.*
        FROM accounting.JournalEntryLines line WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN accounting.V_JournalEntryLineSummary viewLine ON viewLine.journalEntryLineId = line.JournalEntryLineId
        WHERE line.TenantId = @TenantId
          AND line.CompanyId = @CompanyId
          AND line.JournalEntryId = @JournalEntryId
        ORDER BY viewLine.lineNumber;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "JournalEntryId", value: journalEntryId }
      ]
    );

    return rows.map((row) => this.mapLine(row));
  }

  private async getEntry(context: PostingContextInput, journalEntryId: string): Promise<JournalEntryDetail> {
    const pool = await getSqlServerPool();
    const request = pool.request();
    request.input("TenantId", context.tenantId);
    request.input("CompanyId", context.companyId);
    request.input("JournalEntryId", journalEntryId);
    const header = await request.query<JournalEntrySummary>(`
      SELECT *
      FROM accounting.V_JournalEntrySummary
      WHERE tenantId = @TenantId
        AND companyId = @CompanyId
        AND journalEntryId = @JournalEntryId;
    `);
    if (!header.recordset[0]) {
      throw new NotFoundError("Journal entry not found.", { journalEntryId }, "JOURNAL_ENTRY_NOT_FOUND");
    }

    const lineRequest = pool.request();
    lineRequest.input("JournalEntryId", journalEntryId);
    const lines = await lineRequest.query<JournalEntryLineSummary>(`
      SELECT *
      FROM accounting.V_JournalEntryLineSummary
      WHERE journalEntryId = @JournalEntryId
      ORDER BY lineNumber;
    `);
    const summary = this.mapSummary(header.recordset[0]);
    const mappedLines = lines.recordset.map((row) => this.mapLine(row));
    const isBalanced =
      Math.abs(summary.totalDebit - summary.totalCredit) < 0.0001 &&
      Math.abs(summary.totalDebitBase - summary.totalCreditBase) < 0.0001;

    return {
      ...summary,
      lines: mappedLines,
      canEdit: summary.status === "DRAFT",
      canPost: summary.status === "DRAFT" && mappedLines.length >= 2 && summary.totalDebit > 0 && summary.totalCredit > 0 && isBalanced,
      isBalanced
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
}

export const postingTransactionManager = new PostingTransactionManager();
