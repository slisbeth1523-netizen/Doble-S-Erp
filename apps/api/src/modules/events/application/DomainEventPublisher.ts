import type { DomainEventCreateInput, DomainEventPublishInput, EventContext } from "../domain/events.types.js";
import { domainEventService } from "./DomainEventService.js";

export class DomainEventPublisher {
  publish(event: DomainEventCreateInput): Promise<Awaited<ReturnType<typeof domainEventService.create>>>;
  publish(
    context: EventContext,
    event: DomainEventPublishInput
  ): Promise<Awaited<ReturnType<typeof domainEventService.publish>>>;
  publish(
    contextOrEvent: EventContext | DomainEventCreateInput,
    maybeEvent?: DomainEventPublishInput
  ) {
    if (maybeEvent) {
      return domainEventService.publish(contextOrEvent as EventContext, maybeEvent);
    }

    const event = contextOrEvent as DomainEventCreateInput;
    return domainEventService.create({ ...event, status: "PENDING" });
  }
}

export const domainEventPublisher = new DomainEventPublisher();
