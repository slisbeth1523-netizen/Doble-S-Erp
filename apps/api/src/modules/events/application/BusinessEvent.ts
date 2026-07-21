import type { EventContext } from "../domain/events.types.js";

export type BusinessEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  eventName: string;
  eventType: string;
  sourceModule: string;
  sourceEntity: string;
  sourceEntityId: string;
  payload: TPayload;
  metadata?: Record<string, unknown>;
};

export type BusinessEventEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  context: EventContext;
  event: BusinessEvent<TPayload>;
  domainEventId?: string;
};

export const businessEvents = {
  salesInvoiceApproved: "SalesInvoiceApproved",
  customerCreditNoteApproved: "CustomerCreditNoteApproved",
  customerDebitNoteApproved: "CustomerDebitNoteApproved"
} as const;
