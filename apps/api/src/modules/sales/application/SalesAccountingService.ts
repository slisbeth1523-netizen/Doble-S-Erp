import { ConflictError } from "../../../errors/index.js";
import { accountingPostingService } from "../../accounting/application/AccountingPostingService.js";
import type { PostingRequestPayload } from "../../accounting/validators/posting-engine.validators.js";
import {
  salesAccountingRepository,
  type SalesAccountingSource
} from "../infrastructure/SalesAccountingRepository.js";
import type { SalesInvoiceContext } from "../infrastructure/SalesInvoiceRepository.js";
import type { SalesAccountingPayload } from "../validators/sales-accounting.validators.js";

type SalesAccountingDocument = {
  sourceDocumentType: SalesAccountingSource;
  documentId: string;
};

export class SalesAccountingService {
  constructor(
    private readonly repository = salesAccountingRepository,
    private readonly postingService = accountingPostingService
  ) {}

  getInvoiceAccounting(context: SalesInvoiceContext, invoiceId: string) {
    return this.repository.getStatus(context, "SALES_INVOICE", invoiceId);
  }

  previewInvoice(context: SalesInvoiceContext, invoiceId: string, payload: SalesAccountingPayload = {}) {
    return this.preview(context, { sourceDocumentType: "SALES_INVOICE", documentId: invoiceId }, payload);
  }

  postInvoiceAccounting(context: SalesInvoiceContext, invoiceId: string, payload: SalesAccountingPayload = {}) {
    return this.post(context, { sourceDocumentType: "SALES_INVOICE", documentId: invoiceId }, payload);
  }

  reverseInvoiceAccounting(context: SalesInvoiceContext, invoiceId: string, payload: SalesAccountingPayload = {}) {
    return this.reverse(context, { sourceDocumentType: "SALES_INVOICE", documentId: invoiceId }, payload);
  }

  repostInvoiceAccounting(context: SalesInvoiceContext, invoiceId: string, payload: SalesAccountingPayload = {}) {
    return this.repost(context, { sourceDocumentType: "SALES_INVOICE", documentId: invoiceId }, payload);
  }

  previewCustomerCreditNote(context: SalesInvoiceContext, customerCreditNoteId: string, payload: SalesAccountingPayload = {}) {
    return this.preview(context, { sourceDocumentType: "CUSTOMER_CREDIT_NOTE", documentId: customerCreditNoteId }, payload);
  }

  postCustomerCreditNote(context: SalesInvoiceContext, customerCreditNoteId: string, payload: SalesAccountingPayload = {}) {
    return this.post(context, { sourceDocumentType: "CUSTOMER_CREDIT_NOTE", documentId: customerCreditNoteId }, payload);
  }

  reverseCustomerCreditNote(context: SalesInvoiceContext, customerCreditNoteId: string, payload: SalesAccountingPayload = {}) {
    return this.reverse(context, { sourceDocumentType: "CUSTOMER_CREDIT_NOTE", documentId: customerCreditNoteId }, payload);
  }

  repostCustomerCreditNote(context: SalesInvoiceContext, customerCreditNoteId: string, payload: SalesAccountingPayload = {}) {
    return this.repost(context, { sourceDocumentType: "CUSTOMER_CREDIT_NOTE", documentId: customerCreditNoteId }, payload);
  }

  previewCustomerDebitNote(context: SalesInvoiceContext, accountsReceivableDocumentId: string, payload: SalesAccountingPayload = {}) {
    return this.preview(context, { sourceDocumentType: "CUSTOMER_DEBIT_NOTE", documentId: accountsReceivableDocumentId }, payload);
  }

  postCustomerDebitNote(context: SalesInvoiceContext, accountsReceivableDocumentId: string, payload: SalesAccountingPayload = {}) {
    return this.post(context, { sourceDocumentType: "CUSTOMER_DEBIT_NOTE", documentId: accountsReceivableDocumentId }, payload);
  }

  reverseCustomerDebitNote(context: SalesInvoiceContext, accountsReceivableDocumentId: string, payload: SalesAccountingPayload = {}) {
    return this.reverse(context, { sourceDocumentType: "CUSTOMER_DEBIT_NOTE", documentId: accountsReceivableDocumentId }, payload);
  }

  repostCustomerDebitNote(context: SalesInvoiceContext, accountsReceivableDocumentId: string, payload: SalesAccountingPayload = {}) {
    return this.repost(context, { sourceDocumentType: "CUSTOMER_DEBIT_NOTE", documentId: accountsReceivableDocumentId }, payload);
  }

  private preview(context: SalesInvoiceContext, document: SalesAccountingDocument, payload: SalesAccountingPayload) {
    return this.postingService.preview(context, this.payload(document, payload));
  }

  private async post(context: SalesInvoiceContext, document: SalesAccountingDocument, payload: SalesAccountingPayload) {
    const entry = await this.postingService.create(context, this.payload(document, payload));
    return {
      accounting: await this.repository.getStatus(context, document.sourceDocumentType, document.documentId),
      journalEntry: entry
    };
  }

  private async reverse(context: SalesInvoiceContext, document: SalesAccountingDocument, payload: SalesAccountingPayload) {
    const entry = await this.postingService.reverse(context, this.payload(document, payload));
    return {
      accounting: await this.repository.getStatus(context, document.sourceDocumentType, document.documentId),
      journalEntry: entry
    };
  }

  private async repost(context: SalesInvoiceContext, document: SalesAccountingDocument, payload: SalesAccountingPayload) {
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

  private payload(document: SalesAccountingDocument, payload: SalesAccountingPayload): PostingRequestPayload {
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
