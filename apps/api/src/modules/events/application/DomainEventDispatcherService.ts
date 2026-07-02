import { BaseService } from "../../../services/BaseService.js";
import { logger } from "../../../utils/logger.js";
import type {
  DomainEvent,
  DomainEventDispatchResult,
  EventSubscription
} from "../domain/events.types.js";

export class DomainEventDispatcherService extends BaseService {
  async dispatch(
    event: DomainEvent,
    subscriptions: EventSubscription[]
  ): Promise<DomainEventDispatchResult> {
    let dispatchedCount = 0;

    for (const subscription of subscriptions) {
      logger.info("Domain event subscriber dispatch simulated", {
        tenantId: event.tenantId,
        domainEventId: event.domainEventId,
        eventName: event.eventName,
        subscriberModule: subscription.subscriberModule,
        subscriberName: subscription.subscriberName
      });
      dispatchedCount += 1;
    }

    return {
      dispatchedCount,
      skippedCount: 0,
      errors: []
    };
  }
}

export const domainEventDispatcherService = new DomainEventDispatcherService();
