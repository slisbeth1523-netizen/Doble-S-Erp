import { BaseSqlRepository } from "../../../repositories/BaseSqlRepository.js";
import type { SalesInvoiceContextInput } from "./SalesInvoiceRepository.js";

export type SalesAccountingSource =
  | "SALES_INVOICE"
  | "CUSTOMER_CREDIT_NOTE"
  | "CUSTOMER_DEBIT_NOTE";

export type SalesAccountingStatus =
  | "NOT_POSTED"
  | "POSTED"
  | "REVERSED"
  | "REPOSTED";

export type SalesAccountingEntrySummary = {
  journalEntryId: string;
  entryNumber: string;
  entryDate: Date;
  status: string;
  sourceModule: string;
  sourceDocumentType: string;
  sourceDocumentId: string;
  totalDebit: number;
  totalCredit: number;
  createdAt: Date;
  createdBy?: string;
};

export type SalesAccountingStatusResult = {
  accountingStatus: SalesAccountingStatus;
  sourceModule: "SALES";
  sourceDocumentType: SalesAccountingSource;
  documentId: string;
  journalEntry?: SalesAccountingEntrySummary;
  reversalEntry?: SalesAccountingEntrySummary;
  latestEntry?: SalesAccountingEntrySummary;
};

type EntryRow = {
  JournalEntryId: string;
  EntryNumber: string;
  EntryDate: Date;
  Status: string;
  SourceModule: string;
  SourceDocumentType: string;
  SourceDocumentId: string;
  TotalDebit: number;
  TotalCredit: number;
  CreatedAt: Date;
  CreatedBy: string | null;
};

export class SalesAccountingRepository extends BaseSqlRepository {
  async getStatus(
    context: SalesInvoiceContextInput,
    sourceDocumentType: SalesAccountingSource,
    documentId: string
  ): Promise<SalesAccountingStatusResult> {
    const rows = await this.query<EntryRow>(
      `
        SELECT
          JournalEntryId,
          EntryNumber,
          EntryDate,
          Status,
          SourceModule,
          SourceDocumentType,
          SourceDocumentId,
          TotalDebit,
          TotalCredit,
          CreatedAt,
          CreatedBy
        FROM accounting.JournalEntries
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SourceModule = N'SALES'
          AND SourceDocumentId = @DocumentId
          AND IsActive = 1
          AND (
            SourceDocumentType = @SourceDocumentType
            OR SourceDocumentType = @ReversalSourceDocumentType
          )
        ORDER BY CreatedAt ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "DocumentId", value: documentId },
        { name: "SourceDocumentType", value: sourceDocumentType },
        { name: "ReversalSourceDocumentType", value: `${sourceDocumentType}_REVERSAL` }
      ]
    );

    const entries = rows.map((row) => this.mapEntry(row));
    const originals = entries.filter((entry) => entry.sourceDocumentType === sourceDocumentType);
    const reversals = entries.filter((entry) => entry.sourceDocumentType === `${sourceDocumentType}_REVERSAL`);
    const latestOriginal = originals.at(-1);
    const latestReversal = reversals.at(-1);
    const latestEntry = entries.at(-1);

    let accountingStatus: SalesAccountingStatus = "NOT_POSTED";
    if (latestOriginal && !latestReversal) {
      accountingStatus = "POSTED";
    } else if (latestOriginal && latestReversal && latestOriginal.createdAt > latestReversal.createdAt) {
      accountingStatus = "REPOSTED";
    } else if (latestOriginal && latestReversal) {
      accountingStatus = "REVERSED";
    }

    return {
      accountingStatus,
      sourceModule: "SALES",
      sourceDocumentType,
      documentId,
      journalEntry: latestOriginal,
      reversalEntry: latestReversal,
      latestEntry
    };
  }

  private mapEntry(row: EntryRow): SalesAccountingEntrySummary {
    return {
      journalEntryId: row.JournalEntryId,
      entryNumber: row.EntryNumber,
      entryDate: row.EntryDate,
      status: row.Status,
      sourceModule: row.SourceModule,
      sourceDocumentType: row.SourceDocumentType,
      sourceDocumentId: row.SourceDocumentId,
      totalDebit: Number(row.TotalDebit),
      totalCredit: Number(row.TotalCredit),
      createdAt: row.CreatedAt,
      createdBy: row.CreatedBy ?? undefined
    };
  }
}

export const salesAccountingRepository = new SalesAccountingRepository();
