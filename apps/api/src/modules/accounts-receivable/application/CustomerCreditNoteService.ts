import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { businessEventPublisher } from "../../events/application/BusinessEventPublisher.js";
import { businessEvents } from "../../events/application/BusinessEvent.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  customerCreditNoteRepository,
  type CustomerCreditNoteContextInput,
  type CustomerCreditNoteCreateInput
} from "../infrastructure/CustomerCreditNoteRepository.js";
import type {
  CustomerCreditNoteApplicationCreatePayload,
  CustomerCreditNoteCreatePayload,
  CustomerCreditNoteListQuery
} from "../validators/customer-credit-note.validators.js";

export type CustomerCreditNoteContext = CustomerCreditNoteContextInput & {
  requestId?: string;
  correlationId?: string;
};

export class CustomerCreditNoteService extends BaseService {
  constructor(private readonly repository = customerCreditNoteRepository) {
    super();
  }

  createCustomerCreditNote(context: CustomerCreditNoteContextInput, payload: CustomerCreditNoteCreatePayload) {
    const input: CustomerCreditNoteCreateInput = {
      ...context,
      ...payload
    };

    return this.repository.createCustomerCreditNote(input);
  }

  listCustomerCreditNotes(context: CustomerCreditNoteContextInput, query: CustomerCreditNoteListQuery) {
    return this.repository.listCustomerCreditNotes(context, query);
  }

  getCustomerCreditNote(context: CustomerCreditNoteContextInput, customerCreditNoteId: string) {
    return this.repository.getCustomerCreditNote(context, customerCreditNoteId);
  }

  addApplication(
    context: CustomerCreditNoteContextInput,
    customerCreditNoteId: string,
    payload: CustomerCreditNoteApplicationCreatePayload
  ) {
    return this.repository.addApplication(context, customerCreditNoteId, payload);
  }

  async postCustomerCreditNote(context: CustomerCreditNoteContext, customerCreditNoteId: string) {
    const result = await this.repository.postCustomerCreditNote(context, customerCreditNoteId);
    await businessEventPublisher.publish(context, {
      eventName: businessEvents.customerCreditNoteApproved,
      eventType: businessEvents.customerCreditNoteApproved,
      sourceModule: "sales",
      sourceEntity: "ar.CustomerCreditNotes",
      sourceEntityId: result.id,
      payload: {
        documentId: result.id,
        sourceDocumentType: "CUSTOMER_CREDIT_NOTE",
        creditNoteNumber: result.creditNoteNumber,
        customerId: result.customerId,
        postingDate: result.creditNoteDate.toISOString().slice(0, 10),
        reference: result.creditNoteNumber,
        totalAmount: result.amount
      }
    });

    await this.recordPostSideEffects(context, result);

    return result;
  }

  private async recordPostSideEffects(
    context: CustomerCreditNoteContext,
    result: Awaited<ReturnType<typeof this.repository.postCustomerCreditNote>>
  ) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: "CUSTOMER_CREDIT_NOTE_POSTED",
        entity: "ar.CustomerCreditNotes",
        entityId: result.id,
        metadata: {
          creditNoteNumber: result.creditNoteNumber,
          customerId: result.customerId,
          customerCode: result.customerCode,
          amount: result.amount,
          appliedAmount: result.appliedAmount,
          applicationCount: result.applicationCount,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Customer credit note posted audit could not be recorded", {
        customerCreditNoteId: result.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

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
          eventName: "ar.customer-credit-note.posted",
          eventType: "ar.customer-credit-note.posted",
          sourceModule: "accounts-receivable",
          sourceEntity: "ar.CustomerCreditNotes",
          sourceEntityId: result.id,
          payload: {
            customerCreditNoteId: result.id,
            creditNoteNumber: result.creditNoteNumber,
            customerId: result.customerId,
            amount: result.amount,
            appliedAmount: result.appliedAmount,
            postedBy: context.userId,
            postedAt: result.postedAt?.toISOString()
          }
        }
      );
    } catch (error) {
      logger.warn("Customer credit note posted event could not be published", {
        customerCreditNoteId: result.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const customerCreditNoteService = new CustomerCreditNoteService();
