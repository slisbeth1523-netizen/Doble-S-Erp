import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  salesCreditNoteRepository,
  type SalesCreditNoteContext,
  type SalesCreditNoteContextInput
} from "../infrastructure/SalesCreditNoteRepository.js";
import type {
  SalesCreditNoteCreateFromReturnPayload,
  SalesCreditNoteCreditableReturnListQuery,
  SalesCreditNoteListQuery,
  SalesCreditNotePostPayload
} from "../validators/sales-credit-note.validators.js";

type SalesCreditNoteResult = Awaited<ReturnType<typeof salesCreditNoteRepository.getSalesCreditNote>>;

export class SalesCreditNoteService extends BaseService {
  constructor(private readonly repository = salesCreditNoteRepository) {
    super();
  }

  listCreditableReturns(context: SalesCreditNoteContextInput, query: SalesCreditNoteCreditableReturnListQuery) {
    return this.repository.listCreditableReturns(context, query);
  }

  listSalesCreditNotes(context: SalesCreditNoteContextInput, query: SalesCreditNoteListQuery) {
    return this.repository.listSalesCreditNotes(context, query);
  }

  getSalesCreditNote(context: SalesCreditNoteContextInput, customerCreditNoteId: string) {
    return this.repository.getSalesCreditNote(context, customerCreditNoteId);
  }

  async createFromReturn(context: SalesCreditNoteContext, payload: SalesCreditNoteCreateFromReturnPayload) {
    const result = await this.repository.createFromReturn(context, payload);
    await this.recordSideEffects(context, result, "created");
    return result;
  }

  async postSalesCreditNote(
    context: SalesCreditNoteContext,
    customerCreditNoteId: string,
    payload: SalesCreditNotePostPayload
  ) {
    const result = await this.repository.postSalesCreditNote(context, customerCreditNoteId, payload);
    await this.recordSideEffects(context, result, "posted");
    return result;
  }

  private async recordSideEffects(
    context: SalesCreditNoteContext,
    result: SalesCreditNoteResult,
    action: "created" | "posted"
  ) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: action === "posted" ? "SALES_CREDIT_NOTE_POSTED" : "SALES_CREDIT_NOTE_CREATED",
        entity: "ar.CustomerCreditNotes",
        entityId: result.customerCreditNoteId,
        metadata: {
          creditNoteNumber: result.creditNoteNumber,
          salesReturnId: result.salesReturnId,
          returnNumber: result.returnNumber,
          salesInvoiceId: result.salesInvoiceId,
          invoiceNumber: result.invoiceNumber,
          accountsReceivableDocumentId: result.accountsReceivableDocumentId,
          amount: result.amount,
          status: result.status,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Sales credit note audit could not be recorded", {
        customerCreditNoteId: result.customerCreditNoteId,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const eventName = action === "posted" ? "sales.credit-note.posted" : "sales.credit-note.created";
    try {
      await domainEventPublisher.publish(
        {
          tenantId: context.tenantId,
          companyId: context.companyId,
          userId: context.userId,
          requestId: context.requestId ?? "",
          correlationId: context.correlationId ?? context.requestId ?? ""
        },
        {
          eventName,
          eventType: eventName,
          sourceModule: "sales",
          sourceEntity: "ar.CustomerCreditNotes",
          sourceEntityId: result.customerCreditNoteId,
          payload: {
            customerCreditNoteId: result.customerCreditNoteId,
            creditNoteNumber: result.creditNoteNumber,
            salesReturnId: result.salesReturnId,
            salesInvoiceId: result.salesInvoiceId,
            accountsReceivableDocumentId: result.accountsReceivableDocumentId,
            amount: result.amount,
            status: result.status
          }
        }
      );
    } catch (error) {
      logger.warn("Sales credit note event could not be published", {
        customerCreditNoteId: result.customerCreditNoteId,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const salesCreditNoteService = new SalesCreditNoteService();
