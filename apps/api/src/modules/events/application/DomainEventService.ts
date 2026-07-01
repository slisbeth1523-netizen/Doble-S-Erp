import { BaseService } from "../../../services/BaseService.js";
import { logger } from "../../../utils/logger.js";
import type {
  DomainEventCreateInput,
  DomainEventPublishInput,
  DomainEventQuery,
  EventContext
} from "../domain/events.types.js";
import { DomainEventRepository } from "../infrastructure/DomainEventRepository.js";

export class DomainEventService extends BaseService {
  constructor(private readonly repository = new DomainEventRepository()) {
    super();
  }

  async list(query: DomainEventQuery) {
    return this.repository.list(query);
  }

  async getById(context: EventContext, eventId: string) {
    const event = await this.repository.findById(context.tenantId, eventId);
    return this.ensureFound(event, "Domain event not found");
  }

  async publish(context: EventContext, input: DomainEventPublishInput) {
    const event = await this.create({
      ...input,
      tenantId: context.tenantId,
      companyId: input.companyId ?? context.companyId ?? null,
      status: "PENDING",
      requestId: context.requestId,
      correlationId: context.correlationId,
      createdBy: context.userId
    });

    logger.info("Domain event published", {
      tenantId: context.tenantId,
      eventName: event.eventName,
      sourceModule: event.sourceModule,
      sourceEntity: event.sourceEntity,
      sourceEntityId: event.sourceEntityId
    });

    return event;
  }

  async create(input: DomainEventCreateInput) {
    const event = await this.repository.create({ ...input, status: input.status ?? "PENDING" });
    return this.ensureFound(event, "Domain event could not be created");
  }
}

export const domainEventService = new DomainEventService();
