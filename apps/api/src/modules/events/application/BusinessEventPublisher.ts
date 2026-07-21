import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import { domainEventPublisher } from "./DomainEventPublisher.js";
import type { BusinessEvent, BusinessEventEnvelope } from "./BusinessEvent.js";
import { businessEventDispatcher } from "./BusinessEventDispatcher.js";
import type { EventContext } from "../domain/events.types.js";

export class BusinessEventPublisher {
  constructor(private readonly dispatcher = businessEventDispatcher) {}

  async publish(context: EventContext, event: BusinessEvent) {
    const persisted = await domainEventPublisher.publish(context, {
      eventName: event.eventName,
      eventType: event.eventType,
      sourceModule: event.sourceModule,
      sourceEntity: event.sourceEntity,
      sourceEntityId: event.sourceEntityId,
      payload: event.payload,
      metadata: event.metadata,
      companyId: context.companyId ?? (event.metadata?.companyId as string | null | undefined)
    });

    await this.auditSafely(context, event, persisted.domainEventId);
    const envelope: BusinessEventEnvelope = {
      context,
      event,
      domainEventId: persisted.domainEventId
    };
    const dispatchResult = await this.dispatcher.dispatch(envelope);

    return { event: persisted, dispatchResult };
  }

  private async auditSafely(context: EventContext, event: BusinessEvent, domainEventId: string) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId ?? undefined,
        userId: context.userId,
        action: "BUSINESS_EVENT_PUBLISHED",
        entity: "events.DomainEvents",
        entityId: domainEventId,
        metadata: {
          eventName: event.eventName,
          sourceModule: event.sourceModule,
          sourceEntity: event.sourceEntity,
          sourceEntityId: event.sourceEntityId,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Business event audit could not be recorded", {
        eventName: event.eventName,
        sourceEntityId: event.sourceEntityId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const businessEventPublisher = new BusinessEventPublisher();
