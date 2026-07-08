import { BaseService } from "../../../services/BaseService.js";
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
  constructor(private readonly repository = physicalCountRepository) {
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

  createAdjustmentFromPhysicalCount(context: PhysicalCountContext, physicalCountId: string) {
    return this.repository.createAdjustmentFromPhysicalCount({
      ...this.toRepositoryContext(context),
      physicalCountId
    });
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
