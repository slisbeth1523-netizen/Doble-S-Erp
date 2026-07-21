import { ValidationError } from "../../../errors/index.js";
import { businessEvents, type BusinessEventEnvelope } from "../../events/application/BusinessEvent.js";
import { AccountingEventHandler } from "../../accounting/application/AccountingEventHandler.js";
import type { PostingRequestPayload } from "../../accounting/validators/posting-engine.validators.js";

type SalesAccountingPayload = {
  documentId?: unknown;
  sourceDocumentType?: unknown;
  postingDate?: unknown;
  reference?: unknown;
};

const sourceByEventName: Record<string, string> = {
  [businessEvents.salesInvoiceApproved]: "SALES_INVOICE",
  [businessEvents.customerCreditNoteApproved]: "CUSTOMER_CREDIT_NOTE",
  [businessEvents.customerDebitNoteApproved]: "CUSTOMER_DEBIT_NOTE"
};

export class SalesAccountingHandler extends AccountingEventHandler {
  readonly name = "SalesAccountingHandler";

  canHandle(envelope: BusinessEventEnvelope) {
    return envelope.event.sourceModule === "sales" && Boolean(sourceByEventName[envelope.event.eventName]);
  }

  protected toPostingPayload(envelope: BusinessEventEnvelope): PostingRequestPayload {
    const payload = envelope.event.payload as SalesAccountingPayload;
    const sourceModule = String(payload.sourceDocumentType ?? sourceByEventName[envelope.event.eventName] ?? "");
    const documentId = typeof payload.documentId === "string" ? payload.documentId : envelope.event.sourceEntityId;
    if (!sourceModule || !documentId) {
      throw new ValidationError(
        "Business event does not contain a valid sales accounting source.",
        { eventName: envelope.event.eventName, payload },
        "BUSINESS_EVENT_SALES_ACCOUNTING_SOURCE_INVALID"
      );
    }

    return {
      sourceModule,
      documentId,
      postingDate: typeof payload.postingDate === "string" ? payload.postingDate : undefined,
      reference: typeof payload.reference === "string" ? payload.reference : undefined
    };
  }
}

export const salesAccountingHandler = new SalesAccountingHandler();
