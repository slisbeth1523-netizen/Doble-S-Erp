import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  inventoryReservationRepository,
  type InventoryReservationContext,
  type InventoryReservationContextInput,
  type InventoryReservationResult
} from "../infrastructure/InventoryReservationRepository.js";
import type {
  InventoryAvailabilityListQuery,
  InventoryReservationCreatePayload,
  InventoryReservationListQuery,
  InventoryReservationReleasePayload
} from "../validators/inventory-reservation.validators.js";

type SideEffectAction = "created" | "released";

const auditActions: Record<SideEffectAction, string> = {
  created: "INVENTORY_RESERVATION_CREATED",
  released: "INVENTORY_RESERVATION_RELEASED"
};

export class InventoryReservationService extends BaseService {
  constructor(private readonly repository = inventoryReservationRepository) {
    super();
  }

  listAvailability(context: InventoryReservationContextInput, query: InventoryAvailabilityListQuery) {
    return this.repository.listAvailability(context, query);
  }

  getAvailabilityByItem(context: InventoryReservationContextInput, itemId: string) {
    return this.repository.getAvailabilityByItem(context, itemId);
  }

  listReservations(context: InventoryReservationContextInput, query: InventoryReservationListQuery) {
    return this.repository.listReservations(context, query);
  }

  getSalesOrderReservations(context: InventoryReservationContextInput, salesOrderId: string) {
    return this.repository.getSalesOrderReservations(context, salesOrderId);
  }

  async reserveSalesOrderLine(
    context: InventoryReservationContext,
    salesOrderId: string,
    salesOrderLineId: string,
    payload: InventoryReservationCreatePayload
  ) {
    const result = await this.repository.reserveSalesOrderLine(context, salesOrderId, salesOrderLineId, payload);
    await this.recordSideEffects(context, result, "created");
    return result;
  }

  async releaseReservation(
    context: InventoryReservationContext,
    inventoryReservationId: string,
    payload: InventoryReservationReleasePayload
  ) {
    const result = await this.repository.releaseReservation(context, inventoryReservationId, payload);
    await this.recordSideEffects(context, result, "released");
    return result;
  }

  private async recordSideEffects(
    context: InventoryReservationContext,
    result: InventoryReservationResult,
    action: SideEffectAction
  ) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: auditActions[action],
        entity: "inventory.InventoryReservations",
        entityId: result.id,
        metadata: {
          salesOrderId: result.salesOrderId,
          salesOrderLineId: result.salesOrderLineId,
          itemId: result.itemId,
          warehouseId: result.warehouseId,
          reservedQuantity: result.reservedQuantity,
          releasedQuantity: result.releasedQuantity,
          activeQuantity: result.activeQuantity,
          status: result.status,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Inventory reservation audit could not be recorded", {
        inventoryReservationId: result.id,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const eventName =
      action === "created"
        ? "inventory.reservation.created"
        : result.status === "RELEASED"
          ? "inventory.reservation.released"
          : "inventory.reservation.partially-released";

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
          sourceModule: "inventory",
          sourceEntity: "inventory.InventoryReservations",
          sourceEntityId: result.id,
          payload: {
            inventoryReservationId: result.id,
            salesOrderId: result.salesOrderId,
            salesOrderLineId: result.salesOrderLineId,
            itemId: result.itemId,
            warehouseId: result.warehouseId,
            activeQuantity: result.activeQuantity,
            status: result.status,
            action
          }
        }
      );
    } catch (error) {
      logger.warn("Inventory reservation event could not be published", {
        inventoryReservationId: result.id,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const inventoryReservationService = new InventoryReservationService();
