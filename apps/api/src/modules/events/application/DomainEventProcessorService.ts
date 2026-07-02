import { randomUUID } from "crypto";

import { ConflictError } from "../../../errors/index.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import type {
  DomainEvent,
  DomainEventBatchProcessResult,
  DomainEventDispatchResult,
  DomainEventProcessResult,
  EventContext
} from "../domain/events.types.js";
import { DomainEventRepository } from "../infrastructure/DomainEventRepository.js";
import { domainEventDispatcherService } from "./DomainEventDispatcherService.js";

const defaultBatchLimit = 20;

export class DomainEventProcessorService extends BaseService {
  constructor(private readonly repository = new DomainEventRepository()) {
    super();
  }

  async processPendingBatch(
    context: EventContext,
    limit = defaultBatchLimit
  ): Promise<DomainEventBatchProcessResult> {
    const lockedBy = `api:${process.pid}:${randomUUID()}`;
    const lockedEvents = await this.repository.lockPendingBatch(limit, lockedBy, context.tenantId);
    const processingEvents = await this.repository.getPendingBatch(limit, lockedBy, context.tenantId);
    const events = processingEvents.length > 0 ? processingEvents : lockedEvents;
    const results: DomainEventProcessResult[] = [];

    logger.info("Domain event processor batch locked", {
      tenantId: context.tenantId,
      lockedBy,
      count: events.length
    });

    for (const event of events) {
      results.push(await this.processEvent(context, event));
    }

    return {
      lockedBy,
      processedCount: results.length,
      results
    };
  }

  async retryEvent(context: EventContext, eventId: string) {
    const event = await this.repository.findById(context.tenantId, eventId);
    const found = this.ensureFound(event, "Domain event not found");

    if (found.status === "PROCESSING") {
      throw new ConflictError("Domain event is currently processing", undefined, "DOMAIN_EVENT_PROCESSING");
    }

    const locked = await this.repository.markProcessing(eventId, `api:${process.pid}:${randomUUID()}`);

    if (!locked) {
      throw new ConflictError(
        "Domain event could not be scheduled for retry",
        undefined,
        "DOMAIN_EVENT_RETRY_BLOCKED"
      );
    }

    return this.processEvent(context, locked);
  }

  async processEvent(context: EventContext, event: DomainEvent): Promise<DomainEventProcessResult> {
    await this.auditSafely(context, "DOMAIN_EVENT_PROCESSING_STARTED", event);

    try {
      const subscriptions = await this.repository.getActiveSubscriptions(event.eventName, event.tenantId);

      if (subscriptions.length === 0) {
        const ignored = this.ensureFound(
          await this.repository.markIgnored(event.domainEventId),
          "Domain event could not be marked as ignored"
        );
        await this.auditSafely(context, "DOMAIN_EVENT_IGNORED", ignored);
        logger.info("Domain event ignored without active subscriptions", {
          tenantId: event.tenantId,
          domainEventId: event.domainEventId,
          eventName: event.eventName
        });

        return { event: ignored, status: ignored.status };
      }

      const dispatchResult = await domainEventDispatcherService.dispatch(event, subscriptions);

      if (dispatchResult.errors.length > 0) {
        return this.handleProcessingFailure(
          context,
          event,
          "Domain event dispatch simulation failed",
          dispatchResult
        );
      }

      const processed = this.ensureFound(
        await this.repository.markProcessed(event.domainEventId),
        "Domain event could not be marked as processed"
      );
      await this.auditSafely(context, "DOMAIN_EVENT_PROCESSED", processed, dispatchResult);

      return {
        event: processed,
        status: processed.status,
        dispatchResult
      };
    } catch (error) {
      return this.handleProcessingFailure(context, event, this.errorMessage(error));
    }
  }

  async listActiveSubscriptions(context: EventContext, eventName: string) {
    return this.repository.getActiveSubscriptions(eventName, context.tenantId);
  }

  private async handleProcessingFailure(
    context: EventContext,
    event: DomainEvent,
    errorMessage: string,
    dispatchResult?: DomainEventDispatchResult
  ): Promise<DomainEventProcessResult> {
    const nextRetryCount = event.retryCount + 1;

    if (nextRetryCount < event.maxRetries) {
      const nextAttemptAt = new Date(Date.now() + 60_000);
      const retryEvent = this.ensureFound(
        await this.repository.releaseForRetry(event.domainEventId, errorMessage, nextAttemptAt),
        "Domain event could not be released for retry"
      );
      await this.auditSafely(context, "DOMAIN_EVENT_RETRY_SCHEDULED", retryEvent, dispatchResult);

      return {
        event: retryEvent,
        status: retryEvent.status,
        dispatchResult
      };
    }

    const failed = this.ensureFound(
      await this.repository.markFailed(event.domainEventId, errorMessage),
      "Domain event could not be marked as failed"
    );
    await this.auditSafely(context, "DOMAIN_EVENT_FAILED", failed, dispatchResult);

    return {
      event: failed,
      status: failed.status,
      dispatchResult
    };
  }

  private async auditSafely(
    context: EventContext,
    action: string,
    event: DomainEvent,
    dispatchResult?: DomainEventDispatchResult
  ) {
    try {
      await auditEvent({
        tenantId: event.tenantId,
        companyId: event.companyId ?? context.companyId ?? undefined,
        userId: context.userId,
        action,
        entity: "events.DomainEvents",
        entityId: event.domainEventId,
        metadata: {
          eventName: event.eventName,
          status: event.status,
          retryCount: event.retryCount,
          maxRetries: event.maxRetries,
          requestId: context.requestId,
          correlationId: context.correlationId,
          dispatchResult
        }
      });
    } catch {
      logger.warn("Domain event processor audit could not be recorded", {
        tenantId: event.tenantId,
        domainEventId: event.domainEventId,
        action
      });
    }
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message.slice(0, 500);
    }

    return "Domain event processing failed";
  }
}

export const domainEventProcessorService = new DomainEventProcessorService();
