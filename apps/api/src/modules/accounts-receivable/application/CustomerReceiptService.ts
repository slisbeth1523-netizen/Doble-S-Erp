import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  customerReceiptRepository,
  type CustomerReceiptContextInput,
  type CustomerReceiptCreateInput
} from "../infrastructure/CustomerReceiptRepository.js";
import type {
  CustomerReceiptApplicationCreatePayload,
  CustomerReceiptCreatePayload,
  CustomerReceiptListQuery
} from "../validators/customer-receipt.validators.js";

export type CustomerReceiptContext = CustomerReceiptContextInput & {
  requestId?: string;
  correlationId?: string;
};

export class CustomerReceiptService extends BaseService {
  constructor(private readonly repository = customerReceiptRepository) {
    super();
  }

  createCustomerReceipt(context: CustomerReceiptContextInput, payload: CustomerReceiptCreatePayload) {
    const input: CustomerReceiptCreateInput = {
      ...context,
      ...payload
    };

    return this.repository.createCustomerReceipt(input);
  }

  listCustomerReceipts(context: CustomerReceiptContextInput, query: CustomerReceiptListQuery) {
    return this.repository.listCustomerReceipts(context, query);
  }

  getCustomerReceipt(context: CustomerReceiptContextInput, customerReceiptId: string) {
    return this.repository.getCustomerReceipt(context, customerReceiptId);
  }

  addApplication(
    context: CustomerReceiptContextInput,
    customerReceiptId: string,
    payload: CustomerReceiptApplicationCreatePayload
  ) {
    return this.repository.addApplication(context, customerReceiptId, payload);
  }

  async postCustomerReceipt(context: CustomerReceiptContext, customerReceiptId: string) {
    const result = await this.repository.postCustomerReceipt(context, customerReceiptId);

    await this.recordPostSideEffects(context, result);

    return result;
  }

  private async recordPostSideEffects(
    context: CustomerReceiptContext,
    result: Awaited<ReturnType<typeof this.repository.postCustomerReceipt>>
  ) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: "CUSTOMER_RECEIPT_POSTED",
        entity: "ar.CustomerReceipts",
        entityId: result.id,
        metadata: {
          receiptNumber: result.receiptNumber,
          customerId: result.customerId,
          customerCode: result.customerCode,
          totalAmount: result.totalAmount,
          appliedAmount: result.appliedAmount,
          applicationCount: result.applicationCount,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Customer receipt posted audit could not be recorded", {
        customerReceiptId: result.id,
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
          eventName: "ar.customer-receipt.posted",
          eventType: "ar.customer-receipt.posted",
          sourceModule: "accounts-receivable",
          sourceEntity: "ar.CustomerReceipts",
          sourceEntityId: result.id,
          payload: {
            customerReceiptId: result.id,
            receiptNumber: result.receiptNumber,
            customerId: result.customerId,
            totalAmount: result.totalAmount,
            appliedAmount: result.appliedAmount,
            postedBy: context.userId,
            postedAt: result.postedAt?.toISOString()
          }
        }
      );
    } catch (error) {
      logger.warn("Customer receipt posted event could not be published", {
        customerReceiptId: result.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const customerReceiptService = new CustomerReceiptService();
