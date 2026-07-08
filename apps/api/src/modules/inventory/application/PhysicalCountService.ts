import { BaseService } from "../../../services/BaseService.js";
import { inventoryAdjustmentService } from "./InventoryAdjustmentService.js";
import {
  physicalCountRepository,
  type PhysicalCountContextInput
} from "../infrastructure/PhysicalCountRepository.js";
import type {
  PhysicalCountCreatePayload,
  PhysicalCountLineCreatePayload
} from "../validators/physical-count.validators.js";

export type PhysicalCountContext = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export class PhysicalCountService extends BaseService {
  constructor(
    private readonly repository = physicalCountRepository,
    private readonly adjustmentService = inventoryAdjustmentService
  ) {
    super();
  }

  createPhysicalCount(context: PhysicalCountContext, payload: PhysicalCountCreatePayload) {
    return this.repository.createPhysicalCount({
      ...this.toRepositoryContext(context),
      ...payload
    });
  }

  addPhysicalCountLine(
    context: PhysicalCountContext,
    physicalCountId: string,
    payload: PhysicalCountLineCreatePayload
  ) {
    return this.repository.addPhysicalCountLine({
      ...this.toRepositoryContext(context),
      ...payload,
      physicalCountId
    });
  }

  completePhysicalCount(context: PhysicalCountContext, physicalCountId: string) {
    return this.repository.completePhysicalCount({
      ...this.toRepositoryContext(context),
      physicalCountId
    });
  }

  async createAdjustmentFromPhysicalCount(context: PhysicalCountContext, physicalCountId: string) {
    const repositoryContext = this.toRepositoryContext(context);
    const adjustmentPayload = await this.repository.getAdjustmentPayload({
      ...repositoryContext,
      physicalCountId
    });
    const adjustment = await this.adjustmentService.createAdjustment(context, {
      movementType: adjustmentPayload.movementType,
      reference: adjustmentPayload.reference,
      notes: adjustmentPayload.notes,
      lines: adjustmentPayload.lines
    });
    const physicalCount = await this.repository.attachAdjustmentMovement({
      ...repositoryContext,
      physicalCountId,
      adjustmentMovementId: adjustment.id
    });

    return {
      physicalCount,
      adjustment
    };
  }

  private toRepositoryContext(context: PhysicalCountContext): PhysicalCountContextInput {
    return {
      tenantId: context.tenantId,
      companyId: context.companyId,
      userId: context.userId
    };
  }
}

export const physicalCountService = new PhysicalCountService();
