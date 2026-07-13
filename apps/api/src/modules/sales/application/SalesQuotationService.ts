import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  salesQuotationRepository,
  type SalesQuotationContext,
  type SalesQuotationContextInput,
  type SalesQuotationCreateInput,
  type SalesQuotationResult,
  type SalesQuotationStatus,
  type SalesQuotationUpdateInput
} from "../infrastructure/SalesQuotationRepository.js";
import type {
  SalesQuotationCreatePayload,
  SalesQuotationLineCreatePayload,
  SalesQuotationLineUpdatePayload,
  SalesQuotationListQuery,
  SalesQuotationUpdatePayload
} from "../validators/sales-quotation.validators.js";

type SideEffectAction = "created" | "updated" | "sent" | "approved" | "rejected" | "expired";

const auditActions: Record<SideEffectAction, string> = {
  created: "SALES_QUOTATION_CREATED",
  updated: "SALES_QUOTATION_UPDATED",
  sent: "SALES_QUOTATION_SENT",
  approved: "SALES_QUOTATION_APPROVED",
  rejected: "SALES_QUOTATION_REJECTED",
  expired: "SALES_QUOTATION_EXPIRED"
};

const eventNames: Partial<Record<SideEffectAction, string>> = {
  created: "sales.quotation.created",
  sent: "sales.quotation.sent",
  approved: "sales.quotation.approved",
  rejected: "sales.quotation.rejected",
  expired: "sales.quotation.expired"
};

export class SalesQuotationService extends BaseService {
  constructor(private readonly repository = salesQuotationRepository) {
    super();
  }

  async createQuotation(context: SalesQuotationContext, payload: SalesQuotationCreatePayload) {
    const input: SalesQuotationCreateInput = {
      ...context,
      ...payload
    };
    const result = await this.repository.createQuotation(input);
    await this.recordSideEffects(context, result, "created");
    return result;
  }

  listQuotations(context: SalesQuotationContextInput, query: SalesQuotationListQuery) {
    return this.repository.listQuotations(context, query);
  }

  getQuotation(context: SalesQuotationContextInput, salesQuotationId: string) {
    return this.repository.getQuotation(context, salesQuotationId);
  }

  async updateQuotation(
    context: SalesQuotationContext,
    salesQuotationId: string,
    payload: SalesQuotationUpdatePayload
  ) {
    const input: SalesQuotationUpdateInput = {
      ...context,
      ...payload
    };
    const result = await this.repository.updateQuotation(input, salesQuotationId, payload);
    await this.recordSideEffects(context, result, "updated");
    return result;
  }

  async addLine(
    context: SalesQuotationContext,
    salesQuotationId: string,
    payload: SalesQuotationLineCreatePayload
  ) {
    const result = await this.repository.addLine(context, salesQuotationId, payload);
    await this.recordSideEffects(context, result, "updated");
    return result;
  }

  async updateLine(
    context: SalesQuotationContext,
    salesQuotationId: string,
    salesQuotationLineId: string,
    payload: SalesQuotationLineUpdatePayload
  ) {
    const result = await this.repository.updateLine(context, salesQuotationId, salesQuotationLineId, payload);
    await this.recordSideEffects(context, result, "updated");
    return result;
  }

  async deleteLine(context: SalesQuotationContext, salesQuotationId: string, salesQuotationLineId: string) {
    const result = await this.repository.deleteLine(context, salesQuotationId, salesQuotationLineId);
    await this.recordSideEffects(context, result, "updated");
    return result;
  }

  async sendQuotation(context: SalesQuotationContext, salesQuotationId: string) {
    return this.transition(context, salesQuotationId, "send", "sent");
  }

  async approveQuotation(context: SalesQuotationContext, salesQuotationId: string) {
    return this.transition(context, salesQuotationId, "approve", "approved");
  }

  async rejectQuotation(context: SalesQuotationContext, salesQuotationId: string) {
    return this.transition(context, salesQuotationId, "reject", "rejected");
  }

  async expireQuotation(context: SalesQuotationContext, salesQuotationId: string) {
    return this.transition(context, salesQuotationId, "expire", "expired");
  }

  private async transition(
    context: SalesQuotationContext,
    salesQuotationId: string,
    repositoryAction: "send" | "approve" | "reject" | "expire",
    sideEffectAction: SideEffectAction
  ) {
    const result = await this.repository.transition(context, salesQuotationId, repositoryAction);
    await this.recordSideEffects(context, result, sideEffectAction);
    return result;
  }

  private async recordSideEffects(
    context: SalesQuotationContext,
    result: SalesQuotationResult,
    action: SideEffectAction
  ) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: auditActions[action],
        entity: "sales.SalesQuotations",
        entityId: result.id,
        metadata: {
          quotationNumber: result.quotationNumber,
          customerId: result.customerId,
          status: result.status,
          totalAmount: result.totalAmount,
          lineCount: result.lineCount,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Sales quotation audit could not be recorded", {
        salesQuotationId: result.id,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const eventName = eventNames[action];
    if (!eventName) {
      return;
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
          sourceModule: "sales",
          sourceEntity: "sales.SalesQuotations",
          sourceEntityId: result.id,
          payload: {
            salesQuotationId: result.id,
            quotationNumber: result.quotationNumber,
            customerId: result.customerId,
            status: result.status as SalesQuotationStatus,
            totalAmount: result.totalAmount,
            action
          }
        }
      );
    } catch (error) {
      logger.warn("Sales quotation event could not be published", {
        salesQuotationId: result.id,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const salesQuotationService = new SalesQuotationService();
