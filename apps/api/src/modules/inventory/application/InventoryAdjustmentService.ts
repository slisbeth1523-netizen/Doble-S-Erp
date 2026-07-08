import { BaseService } from "../../../services/BaseService.js";
import {
  inventoryAdjustmentRepository,
  type InventoryAdjustmentInput
} from "../infrastructure/InventoryAdjustmentRepository.js";
import type { InventoryAdjustmentCreatePayload } from "../validators/inventory-adjustment.validators.js";

export type InventoryAdjustmentContext = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export class InventoryAdjustmentService extends BaseService {
  constructor(private readonly repository = inventoryAdjustmentRepository) {
    super();
  }

  createAdjustment(context: InventoryAdjustmentContext, payload: InventoryAdjustmentCreatePayload) {
    const input: InventoryAdjustmentInput = {
      ...payload,
      tenantId: context.tenantId,
      companyId: context.companyId,
      createdBy: context.userId
    };

    return this.repository.createAdjustment(input);
  }
}

export const inventoryAdjustmentService = new InventoryAdjustmentService();
