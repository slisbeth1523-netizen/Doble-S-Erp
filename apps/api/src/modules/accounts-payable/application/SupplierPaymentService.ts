import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  supplierPaymentRepository,
  type SupplierPaymentContextInput,
  type SupplierPaymentCreateInput
} from "../infrastructure/SupplierPaymentRepository.js";
import type {
  SupplierPaymentApplicationCreatePayload,
  SupplierPaymentCreatePayload,
  SupplierPaymentListQuery
} from "../validators/supplier-payment.validators.js";

export type SupplierPaymentContext = SupplierPaymentContextInput & {
  requestId?: string;
  correlationId?: string;
};

export class SupplierPaymentService extends BaseService {
  constructor(private readonly repository = supplierPaymentRepository) {
    super();
  }

  createSupplierPayment(context: SupplierPaymentContextInput, payload: SupplierPaymentCreatePayload) {
    const input: SupplierPaymentCreateInput = {
      ...context,
      ...payload
    };

    return this.repository.createSupplierPayment(input);
  }

  listSupplierPayments(context: SupplierPaymentContextInput, query: SupplierPaymentListQuery) {
    return this.repository.listSupplierPayments(context, query);
  }

  getSupplierPayment(context: SupplierPaymentContextInput, supplierPaymentId: string) {
    return this.repository.getSupplierPayment(context, supplierPaymentId);
  }

  addApplication(
    context: SupplierPaymentContextInput,
    supplierPaymentId: string,
    payload: SupplierPaymentApplicationCreatePayload
  ) {
    return this.repository.addApplication(context, supplierPaymentId, payload);
  }

  async postSupplierPayment(context: SupplierPaymentContext, supplierPaymentId: string) {
    const result = await this.repository.postSupplierPayment(context, supplierPaymentId);

    await this.recordPostSideEffects(context, result);

    return result;
  }

  private async recordPostSideEffects(
    context: SupplierPaymentContext,
    result: Awaited<ReturnType<typeof this.repository.postSupplierPayment>>
  ) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: "SUPPLIER_PAYMENT_POSTED",
        entity: "ap.SupplierPayments",
        entityId: result.id,
        metadata: {
          paymentNumber: result.paymentNumber,
          supplierId: result.supplierId,
          supplierCode: result.supplierCode,
          totalAmount: result.totalAmount,
          appliedAmount: result.appliedAmount,
          applicationCount: result.applicationCount,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Supplier payment posted audit could not be recorded", {
        supplierPaymentId: result.id,
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
          eventName: "ap.supplier-payment.posted",
          eventType: "ap.supplier-payment.posted",
          sourceModule: "accounts-payable",
          sourceEntity: "ap.SupplierPayments",
          sourceEntityId: result.id,
          payload: {
            supplierPaymentId: result.id,
            paymentNumber: result.paymentNumber,
            supplierId: result.supplierId,
            totalAmount: result.totalAmount,
            appliedAmount: result.appliedAmount,
            postedBy: context.userId,
            postedAt: result.postedAt?.toISOString()
          }
        }
      );
    } catch (error) {
      logger.warn("Supplier payment posted event could not be published", {
        supplierPaymentId: result.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const supplierPaymentService = new SupplierPaymentService();
