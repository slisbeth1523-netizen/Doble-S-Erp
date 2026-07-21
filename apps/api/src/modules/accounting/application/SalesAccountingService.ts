import { ConflictError } from "../../../errors/index.js";
import { accountingPostingService, type AccountingPostingContext } from "./AccountingPostingService.js";
import type { PostingRequestPayload } from "../validators/posting-engine.validators.js";
import {
  salesAccountingRepository,
  type SalesAccountingSource
} from "../infrastructure/SalesAccountingRepository.js";
import type { AccountingSalesPayload } from "../validators/accounting-sales.validators.js";

export type SalesAccountingDocument = {
  sourceDocumentType: SalesAccountingSource;
  documentId: string;
};

export class SalesAccountingService {
  constructor(
    private readonly repository = salesAccountingRepository,
    private readonly postingService = accountingPostingService
  ) {}

  getInvoiceAccounting(context: AccountingPostingContext, invoiceId: string) {
    return this.repository.getStatus(context, "SALES_INVOICE", invoiceId);
  }

  getSalesDocumentAccounting(context: AccountingPostingContext, document: SalesAccountingDocument) {
    return this.repository.getStatus(context, document.sourceDocumentType, document.documentId);
  }

  previewSalesDocument(context: AccountingPostingContext, document: SalesAccountingDocument, payload: Partial<AccountingSalesPayload> = {}) {
    return this.preview(context, document, payload);
  }

  postSalesDocument(context: AccountingPostingContext, document: SalesAccountingDocument, payload: Partial<AccountingSalesPayload> = {}) {
    return this.post(context, document, payload);
  }

  reverseSalesDocument(context: AccountingPostingContext, document: SalesAccountingDocument, payload: Partial<AccountingSalesPayload> = {}) {
    return this.reverse(context, document, payload);
  }

  repostSalesDocument(context: AccountingPostingContext, document: SalesAccountingDocument, payload: Partial<AccountingSalesPayload> = {}) {
    return this.repost(context, document, payload);
  }

  previewInvoice(context: AccountingPostingContext, invoiceId: string, payload: Partial<AccountingSalesPayload> = {}) {
    return this.preview(context, { sourceDocumentType: "SALES_INVOICE", documentId: invoiceId }, payload);
  }

  postInvoiceAccounting(context: AccountingPostingContext, invoiceId: string, payload: Partial<AccountingSalesPayload> = {}) {
    return this.post(context, { sourceDocumentType: "SALES_INVOICE", documentId: invoiceId }, payload);
  }

  reverseInvoiceAccounting(context: AccountingPostingContext, invoiceId: string, payload: Partial<AccountingSalesPayload> = {}) {
    return this.reverse(context, { sourceDocumentType: "SALES_INVOICE", documentId: invoiceId }, payload);
  }

  repostInvoiceAccounting(context: AccountingPostingContext, invoiceId: string, payload: Partial<AccountingSalesPayload> = {}) {
    return this.repost(context, { sourceDocumentType: "SALES_INVOICE", documentId: invoiceId }, payload);
  }

  private preview(context: AccountingPostingContext, document: SalesAccountingDocument, payload: Partial<AccountingSalesPayload>) {
    return this.postingService.preview(context, this.payload(document, payload));
  }

  private async post(context: AccountingPostingContext, document: SalesAccountingDocument, payload: Partial<AccountingSalesPayload>) {
    const entry = await this.postingService.create(context, this.payload(document, payload));
    return {
      accounting: await this.repository.getStatus(context, document.sourceDocumentType, document.documentId),
      journalEntry: entry
    };
  }

  private async reverse(context: AccountingPostingContext, document: SalesAccountingDocument, payload: Partial<AccountingSalesPayload>) {
    const entry = await this.postingService.reverse(context, this.payload(document, payload));
    return {
      accounting: await this.repository.getStatus(context, document.sourceDocumentType, document.documentId),
      journalEntry: entry
    };
  }

  private async repost(context: AccountingPostingContext, document: SalesAccountingDocument, payload: Partial<AccountingSalesPayload>) {
    const status = await this.repository.getStatus(context, document.sourceDocumentType, document.documentId);
    if (status.accountingStatus === "POSTED" || status.accountingStatus === "REPOSTED") {
      await this.postingService.reverse(context, this.payload(document, payload));
    } else if (status.accountingStatus !== "REVERSED") {
      throw new ConflictError(
        "Sales document must have an accounting entry before it can be reposted.",
        { document },
        "SALES_ACCOUNTING_REPOST_REQUIRES_ENTRY"
      );
    }

    const entry = await this.postingService.create(context, this.payload(document, payload));
    return {
      accounting: await this.repository.getStatus(context, document.sourceDocumentType, document.documentId),
      journalEntry: entry
    };
  }

  private payload(document: SalesAccountingDocument, payload: Partial<AccountingSalesPayload>): PostingRequestPayload {
    return {
      sourceModule: document.sourceDocumentType,
      documentId: document.documentId,
      postingDate: payload.postingDate,
      reference: payload.reference,
      notes: payload.notes
    };
  }
}

export const salesAccountingService = new SalesAccountingService();
