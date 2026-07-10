import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  supplierAdjustmentRepository,
  type SupplierAdjustmentContextInput,
  type SupplierAdjustmentCreateInput
} from "../infrastructure/SupplierAdjustmentRepository.js";
import type {
  SupplierAdjustmentApplicationCreatePayload,
  SupplierAdjustmentCreatePayload,
  SupplierAdjustmentListQuery
} from "../validators/supplier-adjustment.validators.js";

export type SupplierAdjustmentContext = SupplierAdjustmentContextInput & {
  requestId?: string;
  correlationId?: string;
};

export class SupplierAdjustmentService extends BaseService {
  constructor(private readonly repository = supplierAdjustmentRepository) {
    super();
  }

  createSupplierAdjustment(context: SupplierAdjustmentContextInput, payload: SupplierAdjustmentCreatePayload) {
    const input: SupplierAdjustmentCreateInput = {
      ...context,
      ...payload
    };

    return this.repository.createSupplierAdjustment(input);
  }

  listSupplierAdjustments(context: SupplierAdjustmentContextInput, query: SupplierAdjustmentListQuery) {
    return this.repository.listSupplierAdjustments(context, query);
  }

  getSupplierAdjustment(context: SupplierAdjustmentContextInput, supplierAdjustmentId: string) {
    return this.repository.getSupplierAdjustment(context, supplierAdjustmentId);
  }

  addApplication(
    context: SupplierAdjustmentContextInput,
    supplierAdjustmentId: string,
    payload: SupplierAdjustmentApplicationCreatePayload
  ) {
    return this.repository.addApplication(context, supplierAdjustmentId, payload);
  }

  async postSupplierAdjustment(context: SupplierAdjustmentContext, supplierAdjustmentId: string) {
    const result = await this.repository.postSupplierAdjustment(context, supplierAdjustmentId);

    await this.recordPostSideEffects(context, result);

    return result;
  }

  private async recordPostSideEffects(
    context: SupplierAdjustmentContext,
    result: Awaited<ReturnType<typeof this.repository.postSupplierAdjustment>>
  ) {
    const eventName =
      result.adjustmentType === "CREDIT_NOTE"
        ? "ap.supplier-credit-note.posted"
        : "ap.supplier-debit-note.posted";

    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: "SUPPLIER_ADJUSTMENT_POSTED",
        entity: "ap.SupplierAdjustments",
        entityId: result.id,
        metadata: {
          adjustmentNumber: result.adjustmentNumber,
          adjustmentType: result.adjustmentType,
          supplierId: result.supplierId,
          supplierCode: result.supplierCode,
          amount: result.amount,
          appliedAmount: result.appliedAmount,
          applicationCount: result.applicationCount,
          generatedAccountsPayableDocumentId: result.generatedAccountsPayableDocumentId,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Supplier adjustment posted audit could not be recorded", {
        supplierAdjustmentId: result.id,
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
          eventName,
          eventType: eventName,
          sourceModule: "accounts-payable",
          sourceEntity: "ap.SupplierAdjustments",
          sourceEntityId: result.id,
          payload: {
            supplierAdjustmentId: result.id,
            adjustmentNumber: result.adjustmentNumber,
            adjustmentType: result.adjustmentType,
            supplierId: result.supplierId,
            amount: result.amount,
            appliedAmount: result.appliedAmount,
            generatedAccountsPayableDocumentId: result.generatedAccountsPayableDocumentId,
            postedBy: context.userId,
            postedAt: result.postedAt?.toISOString()
          }
        }
      );
    } catch (error) {
      logger.warn("Supplier adjustment posted event could not be published", {
        supplierAdjustmentId: result.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const supplierAdjustmentService = new SupplierAdjustmentService();
