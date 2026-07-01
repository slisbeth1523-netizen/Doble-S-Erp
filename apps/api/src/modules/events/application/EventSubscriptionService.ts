import { ConflictError } from "../../../errors/index.js";
import { BaseService } from "../../../services/BaseService.js";
import { logger } from "../../../utils/logger.js";
import type { EventContext, EventSubscriptionCreateInput } from "../domain/events.types.js";
import { EventSubscriptionRepository } from "../infrastructure/EventSubscriptionRepository.js";

export class EventSubscriptionService extends BaseService {
  constructor(private readonly repository = new EventSubscriptionRepository()) {
    super();
  }

  async list(context: EventContext) {
    return this.repository.list(context.tenantId);
  }

  async create(context: EventContext, input: EventSubscriptionCreateInput) {
    const subscriptionInput = {
      ...input,
      tenantId: input.tenantId === undefined ? context.tenantId : input.tenantId
    };
    const exists = await this.repository.subscriptionExists(subscriptionInput);

    if (exists) {
      throw new ConflictError(
        "Event subscription already exists",
        undefined,
        "EVENT_SUBSCRIPTION_ALREADY_EXISTS"
      );
    }

    const subscription = await this.repository.create(subscriptionInput, context.userId);
    const found = this.ensureFound(subscription, "Event subscription could not be created");

    logger.info("Event subscription created", {
      tenantId: found.tenantId,
      eventName: found.eventName,
      subscriberModule: found.subscriberModule,
      subscriberName: found.subscriberName
    });

    return found;
  }
}

export const eventSubscriptionService = new EventSubscriptionService();
