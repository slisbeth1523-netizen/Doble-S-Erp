import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  inventoryPostingRepository,
  type InventoryPostingInput
} from "../infrastructure/InventoryPostingRepository.js";

export type InventoryPostingContext = {
  tenantId: string;
  companyId: string;
  userId?: string;
  requestId?: string;
  correlationId?: string;
};

export class InventoryPostingService extends BaseService {
  constructor(private readonly repository = inventoryPostingRepository) {
    super();
  }

  async postMovement(context: InventoryPostingContext, movementId: string) {
    const input: InventoryPostingInput = {
      tenantId: context.tenantId,
      companyId: context.companyId,
      movementId,
      postedBy: context.userId
    };
    const result = await this.repository.postMovement(input);

    await this.recordPostSideEffects(context, result);

    return result;
  }

  private async recordPostSideEffects(
    context: InventoryPostingContext,
    result: Awaited<ReturnType<typeof this.repository.postMovement>>
  ) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: "INVENTORY_MOVEMENT_POSTED",
        entity: "inventory.InventoryMovements",
        entityId: result.id,
        metadata: {
          movementNumber: result.movementNumber,
          movementType: result.movementType,
          lineCount: result.lineCount,
          totalQuantity: result.totalQuantity,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Inventory movement posted audit could not be recorded", {
        movementId: result.id,
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
          eventName: "inventory.movement.posted",
          eventType: "inventory.movement.posted",
          sourceModule: "inventory",
          sourceEntity: "inventory.InventoryMovements",
          sourceEntityId: result.id,
          payload: {
            movementId: result.id,
            movementNumber: result.movementNumber,
            tenantId: context.tenantId,
            companyId: context.companyId,
            postedBy: context.userId,
            postedAt: result.postedAt.toISOString()
          }
        }
      );
    } catch (error) {
      logger.warn("Inventory movement posted event could not be published", {
        movementId: result.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const inventoryPostingService = new InventoryPostingService();
