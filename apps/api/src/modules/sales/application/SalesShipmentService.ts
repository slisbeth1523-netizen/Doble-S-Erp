import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  salesShipmentRepository,
  type SalesShipmentContext,
  type SalesShipmentContextInput,
  type SalesShipmentResult
} from "../infrastructure/SalesShipmentRepository.js";
import type {
  SalesShipmentCreatePayload,
  SalesShipmentLineCreatePayload,
  SalesShipmentLineUpdatePayload,
  SalesShipmentListQuery,
  SalesShipmentPostPayload
} from "../validators/sales-shipment.validators.js";

type SideEffectAction = "created" | "lineAdded" | "lineUpdated" | "lineDeleted" | "posted";

const auditActions: Record<SideEffectAction, string> = {
  created: "SALES_SHIPMENT_CREATED",
  lineAdded: "SALES_SHIPMENT_LINE_ADDED",
  lineUpdated: "SALES_SHIPMENT_LINE_UPDATED",
  lineDeleted: "SALES_SHIPMENT_LINE_DELETED",
  posted: "SALES_SHIPMENT_POSTED"
};

export class SalesShipmentService extends BaseService {
  constructor(private readonly repository = salesShipmentRepository) {
    super();
  }

  listShipments(context: SalesShipmentContextInput, query: SalesShipmentListQuery) {
    return this.repository.listShipments(context, query);
  }

  getShipment(context: SalesShipmentContextInput, shipmentId: string) {
    return this.repository.getShipment(context, shipmentId);
  }

  getOrderShipmentLines(context: SalesShipmentContextInput, salesOrderId: string) {
    return this.repository.getOrderShipmentLines(context, salesOrderId);
  }

  async createShipment(context: SalesShipmentContext, payload: SalesShipmentCreatePayload) {
    const result = await this.repository.createShipment(context, payload);
    await this.recordSideEffects(context, result, "created");
    return result;
  }

  async addLine(context: SalesShipmentContext, shipmentId: string, payload: SalesShipmentLineCreatePayload) {
    const result = await this.repository.addLine(context, shipmentId, payload);
    await this.recordSideEffects(context, result, "lineAdded");
    return result;
  }

  async updateLine(
    context: SalesShipmentContext,
    shipmentId: string,
    lineId: string,
    payload: SalesShipmentLineUpdatePayload
  ) {
    const result = await this.repository.updateLine(context, shipmentId, lineId, payload);
    await this.recordSideEffects(context, result, "lineUpdated");
    return result;
  }

  async deleteLine(context: SalesShipmentContext, shipmentId: string, lineId: string) {
    const result = await this.repository.deleteLine(context, shipmentId, lineId);
    await this.recordSideEffects(context, result, "lineDeleted");
    return result;
  }

  async postShipment(context: SalesShipmentContext, shipmentId: string, payload: SalesShipmentPostPayload) {
    const result = await this.repository.postShipment(context, shipmentId, payload);
    if (!result.idempotencyReplayed) {
      await this.recordSideEffects(context, result, "posted");
      if (result.orderClosed) {
        await this.recordOrderClosedSideEffects(context, result);
      }
    }
    return result;
  }

  private async recordSideEffects(context: SalesShipmentContext, result: SalesShipmentResult, action: SideEffectAction) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: auditActions[action],
        entity: "sales.SalesShipments",
        entityId: result.id,
        metadata: {
          shipmentNumber: result.shipmentNumber,
          salesOrderId: result.salesOrderId,
          status: result.status,
          totalQuantity: result.totalQuantity,
          inventoryMovementId: result.inventoryMovementId,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Sales shipment audit could not be recorded", {
        salesShipmentId: result.id,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const eventName = action === "posted" ? "sales.shipment.posted" : "sales.shipment.created";
    if (!["created", "posted"].includes(action)) {
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
          sourceEntity: "sales.SalesShipments",
          sourceEntityId: result.id,
          payload: {
            salesShipmentId: result.id,
            shipmentNumber: result.shipmentNumber,
            salesOrderId: result.salesOrderId,
            inventoryMovementId: result.inventoryMovementId,
            status: result.status
          }
        }
      );
    } catch (error) {
      logger.warn("Sales shipment event could not be published", {
        salesShipmentId: result.id,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async recordOrderClosedSideEffects(context: SalesShipmentContext, result: SalesShipmentResult) {
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
          eventName: "sales.order.closed",
          eventType: "sales.order.closed",
          sourceModule: "sales",
          sourceEntity: "sales.SalesOrders",
          sourceEntityId: result.salesOrderId,
          payload: {
            salesOrderId: result.salesOrderId,
            orderNumber: result.orderNumber,
            closedByShipmentId: result.id
          }
        }
      );
    } catch (error) {
      logger.warn("Sales order closed event could not be published", {
        salesOrderId: result.salesOrderId,
        salesShipmentId: result.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const salesShipmentService = new SalesShipmentService();
