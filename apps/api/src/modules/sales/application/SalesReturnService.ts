import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  salesReturnRepository,
  type SalesReturnContext,
  type SalesReturnContextInput
} from "../infrastructure/SalesReturnRepository.js";
import type {
  SalesReturnCreatePayload,
  SalesReturnLineCreatePayload,
  SalesReturnLineUpdatePayload,
  SalesReturnListQuery,
  SalesReturnPostPayload
} from "../validators/sales-return.validators.js";

type SalesReturnResult = Awaited<ReturnType<typeof salesReturnRepository.getReturn>>;
type SideEffectAction = "created" | "lineAdded" | "lineUpdated" | "lineDeleted" | "posted";

const auditActions: Record<SideEffectAction, string> = {
  created: "SALES_RETURN_CREATED",
  lineAdded: "SALES_RETURN_LINE_ADDED",
  lineUpdated: "SALES_RETURN_LINE_UPDATED",
  lineDeleted: "SALES_RETURN_LINE_DELETED",
  posted: "SALES_RETURN_POSTED"
};

export class SalesReturnService extends BaseService {
  constructor(private readonly repository = salesReturnRepository) {
    super();
  }

  listReturns(context: SalesReturnContextInput, query: SalesReturnListQuery) {
    return this.repository.listReturns(context, query);
  }

  getReturn(context: SalesReturnContextInput, returnId: string) {
    return this.repository.getReturn(context, returnId);
  }

  listShipmentReturnableLines(context: SalesReturnContextInput, shipmentId: string) {
    return this.repository.listShipmentReturnableLines(context, shipmentId);
  }

  listInvoiceReturnableLines(context: SalesReturnContextInput, invoiceId: string) {
    return this.repository.listInvoiceReturnableLines(context, invoiceId);
  }

  async createReturn(context: SalesReturnContext, payload: SalesReturnCreatePayload) {
    const result = await this.repository.createReturn(context, payload);
    await this.recordSideEffects(context, result, "created");
    return result;
  }

  async addLine(context: SalesReturnContext, returnId: string, payload: SalesReturnLineCreatePayload) {
    const result = await this.repository.addLine(context, returnId, payload);
    await this.recordSideEffects(context, result, "lineAdded");
    return result;
  }

  async updateLine(context: SalesReturnContext, returnId: string, lineId: string, payload: SalesReturnLineUpdatePayload) {
    const result = await this.repository.updateLine(context, returnId, lineId, payload);
    await this.recordSideEffects(context, result, "lineUpdated");
    return result;
  }

  async deleteLine(context: SalesReturnContext, returnId: string, lineId: string) {
    const result = await this.repository.deleteLine(context, returnId, lineId);
    await this.recordSideEffects(context, result, "lineDeleted");
    return result;
  }

  async postReturn(context: SalesReturnContext, returnId: string, payload: SalesReturnPostPayload) {
    const result = await this.repository.postReturn(context, returnId, payload);
    if (!result.idempotencyReplayed) {
      await this.recordSideEffects(context, result, "posted");
      await this.recordInventorySideEffects(context, result);
    }
    return result;
  }

  private async recordSideEffects(context: SalesReturnContext, result: SalesReturnResult & { idempotencyReplayed?: boolean }, action: SideEffectAction) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: auditActions[action],
        entity: "sales.SalesReturns",
        entityId: result.id,
        metadata: {
          returnNumber: result.returnNumber,
          salesOrderId: result.salesOrderId,
          salesShipmentId: result.salesShipmentId,
          salesInvoiceId: result.salesInvoiceId,
          inventoryMovementId: result.inventoryMovementId,
          totalQuantity: result.totalQuantity,
          status: result.status,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Sales return audit could not be recorded", {
        salesReturnId: result.id,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    if (!["created", "posted"].includes(action)) return;

    const eventName = action === "posted" ? "sales.return.posted" : "sales.return.created";
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
          sourceEntity: "sales.SalesReturns",
          sourceEntityId: result.id,
          payload: {
            salesReturnId: result.id,
            returnNumber: result.returnNumber,
            salesShipmentId: result.salesShipmentId,
            inventoryMovementId: result.inventoryMovementId,
            status: result.status
          }
        }
      );
    } catch (error) {
      logger.warn("Sales return event could not be published", {
        salesReturnId: result.id,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async recordInventorySideEffects(context: SalesReturnContext, result: SalesReturnResult) {
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
          eventName: "inventory.sales-return.posted",
          eventType: "inventory.sales-return.posted",
          sourceModule: "inventory",
          sourceEntity: "inventory.InventoryMovements",
          sourceEntityId: result.inventoryMovementId ?? result.id,
          payload: {
            salesReturnId: result.id,
            returnNumber: result.returnNumber,
            inventoryMovementId: result.inventoryMovementId,
            totalQuantity: result.totalQuantity
          }
        }
      );
    } catch (error) {
      logger.warn("Sales return inventory event could not be published", {
        salesReturnId: result.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const salesReturnService = new SalesReturnService();
