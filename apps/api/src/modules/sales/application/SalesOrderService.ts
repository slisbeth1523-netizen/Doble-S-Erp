import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  salesOrderRepository,
  type SalesOrderContext,
  type SalesOrderContextInput,
  type SalesOrderCreateInput,
  type SalesOrderResult,
  type SalesOrderStatus,
  type SalesOrderUpdateInput
} from "../infrastructure/SalesOrderRepository.js";
import type {
  SalesOrderCancelPayload,
  SalesOrderCreatePayload,
  SalesOrderLineCreatePayload,
  SalesOrderLineUpdatePayload,
  SalesOrderListQuery,
  SalesOrderUpdatePayload
} from "../validators/sales-order.validators.js";

type SideEffectAction =
  | "created"
  | "createdFromQuotation"
  | "updated"
  | "submitted"
  | "approved"
  | "rejected"
  | "cancelled";

const auditActions: Record<SideEffectAction, string> = {
  created: "SALES_ORDER_CREATED",
  createdFromQuotation: "SALES_ORDER_CREATED_FROM_QUOTATION",
  updated: "SALES_ORDER_UPDATED",
  submitted: "SALES_ORDER_SUBMITTED",
  approved: "SALES_ORDER_APPROVED",
  rejected: "SALES_ORDER_REJECTED",
  cancelled: "SALES_ORDER_CANCELLED"
};

const eventNames: Partial<Record<SideEffectAction, string>> = {
  created: "sales.order.created",
  createdFromQuotation: "sales.order.created-from-quotation",
  submitted: "sales.order.submitted",
  approved: "sales.order.approved",
  rejected: "sales.order.rejected",
  cancelled: "sales.order.cancelled"
};

export class SalesOrderService extends BaseService {
  constructor(private readonly repository = salesOrderRepository) {
    super();
  }

  async createOrder(context: SalesOrderContext, payload: SalesOrderCreatePayload) {
    const input: SalesOrderCreateInput = {
      ...context,
      ...payload
    };
    const result = await this.repository.createOrder(input);
    await this.recordSideEffects(context, result, "created");
    return result;
  }

  async createFromQuotation(context: SalesOrderContext, sourceQuotationId: string) {
    const result = await this.repository.createFromQuotation(context, sourceQuotationId);

    if (!result.reusedExisting) {
      await this.recordSideEffects(context, result.order, "createdFromQuotation");
    }

    return result.order;
  }

  listOrders(context: SalesOrderContextInput, query: SalesOrderListQuery) {
    return this.repository.listOrders(context, query);
  }

  getOrder(context: SalesOrderContextInput, salesOrderId: string) {
    return this.repository.getOrder(context, salesOrderId);
  }

  async updateOrder(context: SalesOrderContext, salesOrderId: string, payload: SalesOrderUpdatePayload) {
    const input: SalesOrderUpdateInput = {
      ...context,
      ...payload
    };
    const result = await this.repository.updateOrder(input, salesOrderId, payload);
    await this.recordSideEffects(context, result, "updated");
    return result;
  }

  async addLine(context: SalesOrderContext, salesOrderId: string, payload: SalesOrderLineCreatePayload) {
    const result = await this.repository.addLine(context, salesOrderId, payload);
    await this.recordSideEffects(context, result, "updated");
    return result;
  }

  async updateLine(
    context: SalesOrderContext,
    salesOrderId: string,
    salesOrderLineId: string,
    payload: SalesOrderLineUpdatePayload
  ) {
    const result = await this.repository.updateLine(context, salesOrderId, salesOrderLineId, payload);
    await this.recordSideEffects(context, result, "updated");
    return result;
  }

  async deleteLine(context: SalesOrderContext, salesOrderId: string, salesOrderLineId: string) {
    const result = await this.repository.deleteLine(context, salesOrderId, salesOrderLineId);
    await this.recordSideEffects(context, result, "updated");
    return result;
  }

  async submitOrder(context: SalesOrderContext, salesOrderId: string) {
    return this.transition(context, salesOrderId, "submit", "submitted");
  }

  async approveOrder(context: SalesOrderContext, salesOrderId: string) {
    return this.transition(context, salesOrderId, "approve", "approved");
  }

  async rejectOrder(context: SalesOrderContext, salesOrderId: string) {
    return this.transition(context, salesOrderId, "reject", "rejected");
  }

  async cancelOrder(context: SalesOrderContext, salesOrderId: string, payload: SalesOrderCancelPayload) {
    return this.transition(context, salesOrderId, "cancel", "cancelled", payload);
  }

  private async transition(
    context: SalesOrderContext,
    salesOrderId: string,
    repositoryAction: "submit" | "approve" | "reject" | "cancel",
    sideEffectAction: SideEffectAction,
    payload?: SalesOrderCancelPayload
  ) {
    const result = await this.repository.transition(context, salesOrderId, repositoryAction, payload);
    await this.recordSideEffects(context, result, sideEffectAction);
    return result;
  }

  private async recordSideEffects(context: SalesOrderContext, result: SalesOrderResult, action: SideEffectAction) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: auditActions[action],
        entity: "sales.SalesOrders",
        entityId: result.id,
        metadata: {
          orderNumber: result.orderNumber,
          sourceQuotationId: result.sourceQuotationId,
          customerId: result.customerId,
          status: result.status,
          totalAmount: result.totalAmount,
          lineCount: result.lineCount,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Sales order audit could not be recorded", {
        salesOrderId: result.id,
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
          sourceEntity: "sales.SalesOrders",
          sourceEntityId: result.id,
          payload: {
            salesOrderId: result.id,
            orderNumber: result.orderNumber,
            sourceQuotationId: result.sourceQuotationId,
            customerId: result.customerId,
            status: result.status as SalesOrderStatus,
            totalAmount: result.totalAmount,
            action
          }
        }
      );
    } catch (error) {
      logger.warn("Sales order event could not be published", {
        salesOrderId: result.id,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const salesOrderService = new SalesOrderService();
