import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  DomainEvent,
  DomainEventCreateInput,
  DomainEventListResult,
  DomainEventQuery,
  EventSubscription
} from "../domain/events.types.js";

const eventColumns = `
  DomainEventId AS domainEventId,
  TenantId AS tenantId,
  CompanyId AS companyId,
  EventName AS eventName,
  EventType AS eventType,
  SourceModule AS sourceModule,
  SourceEntity AS sourceEntity,
  SourceEntityId AS sourceEntityId,
  PayloadJson AS payloadJson,
  MetadataJson AS metadataJson,
  Status AS status,
  CreatedAt AS createdAt,
  ProcessedAt AS processedAt,
  FailedAt AS failedAt,
  ErrorMessage AS errorMessage,
  RetryCount AS retryCount,
  LockedAt AS lockedAt,
  LockedBy AS lockedBy,
  NextAttemptAt AS nextAttemptAt,
  LastAttemptAt AS lastAttemptAt,
  MaxRetries AS maxRetries,
  RequestId AS requestId,
  CorrelationId AS correlationId,
  CreatedBy AS createdBy
`;

const eventOutputColumns = `
  inserted.DomainEventId AS domainEventId,
  inserted.TenantId AS tenantId,
  inserted.CompanyId AS companyId,
  inserted.EventName AS eventName,
  inserted.EventType AS eventType,
  inserted.SourceModule AS sourceModule,
  inserted.SourceEntity AS sourceEntity,
  inserted.SourceEntityId AS sourceEntityId,
  inserted.PayloadJson AS payloadJson,
  inserted.MetadataJson AS metadataJson,
  inserted.Status AS status,
  inserted.CreatedAt AS createdAt,
  inserted.ProcessedAt AS processedAt,
  inserted.FailedAt AS failedAt,
  inserted.ErrorMessage AS errorMessage,
  inserted.RetryCount AS retryCount,
  inserted.LockedAt AS lockedAt,
  inserted.LockedBy AS lockedBy,
  inserted.NextAttemptAt AS nextAttemptAt,
  inserted.LastAttemptAt AS lastAttemptAt,
  inserted.MaxRetries AS maxRetries,
  inserted.RequestId AS requestId,
  inserted.CorrelationId AS correlationId,
  inserted.CreatedBy AS createdBy
`;

export class DomainEventRepository extends BaseSqlRepository {
  async create(input: DomainEventCreateInput) {
    const result = await this.query<DomainEvent>(
      `
        INSERT INTO events.DomainEvents (
          TenantId,
          CompanyId,
          EventName,
          EventType,
          SourceModule,
          SourceEntity,
          SourceEntityId,
          PayloadJson,
          MetadataJson,
          Status,
          RequestId,
          CorrelationId,
          CreatedBy
        )
        OUTPUT ${eventOutputColumns}
        VALUES (
          @TenantId,
          @CompanyId,
          @EventName,
          @EventType,
          @SourceModule,
          @SourceEntity,
          @SourceEntityId,
          @PayloadJson,
          @MetadataJson,
          @Status,
          @RequestId,
          @CorrelationId,
          @CreatedBy
        )
      `,
      [
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId ?? null },
        { name: "EventName", value: input.eventName },
        { name: "EventType", value: input.eventType },
        { name: "SourceModule", value: input.sourceModule },
        { name: "SourceEntity", value: input.sourceEntity },
        { name: "SourceEntityId", value: input.sourceEntityId },
        { name: "PayloadJson", value: input.payload ? JSON.stringify(input.payload) : null },
        { name: "MetadataJson", value: input.metadata ? JSON.stringify(input.metadata) : null },
        { name: "Status", value: input.status ?? "PENDING" },
        { name: "RequestId", value: input.requestId ?? null },
        { name: "CorrelationId", value: input.correlationId ?? null },
        { name: "CreatedBy", value: input.createdBy ?? null }
      ]
    );

    return result[0];
  }

  async findById(tenantId: string, eventId: string) {
    const result = await this.query<DomainEvent>(
      `
        SELECT ${eventColumns}
        FROM events.DomainEvents
        WHERE TenantId = @TenantId
          AND DomainEventId = @DomainEventId
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "DomainEventId", value: eventId }
      ]
    );

    return result[0];
  }

  async list(query: DomainEventQuery): Promise<DomainEventListResult> {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: query.tenantId },
      { name: "Offset", value: query.offset },
      { name: "PageSize", value: query.pageSize }
    ];
    const filters = ["TenantId = @TenantId"];

    if (query.eventName) {
      parameters.push({ name: "EventName", value: query.eventName });
      filters.push("EventName = @EventName");
    }

    if (query.status) {
      parameters.push({ name: "Status", value: query.status });
      filters.push("Status = @Status");
    }

    if (query.sourceModule) {
      parameters.push({ name: "SourceModule", value: query.sourceModule });
      filters.push("SourceModule = @SourceModule");
    }

    const whereClause = filters.join(" AND ");
    const rows = await this.query<DomainEvent & { totalItems: number }>(
      `
        SELECT ${eventColumns},
               COUNT(1) OVER() AS totalItems
        FROM events.DomainEvents
        WHERE ${whereClause}
        ORDER BY CreatedAt DESC
        OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY
      `,
      parameters
    );

    return {
      items: rows,
      totalItems: rows[0]?.totalItems ?? 0
    };
  }

  async getPendingBatch(limit: number, lockedBy: string, tenantId: string) {
    return this.query<DomainEvent>(
      `
        SELECT TOP (@Limit) ${eventColumns}
        FROM events.DomainEvents WITH (READPAST)
        WHERE TenantId = @TenantId
          AND Status = 'PROCESSING'
          AND LockedBy = @LockedBy
        ORDER BY LastAttemptAt ASC, CreatedAt ASC
      `,
      [
        { name: "Limit", value: limit },
        { name: "LockedBy", value: lockedBy },
        { name: "TenantId", value: tenantId }
      ]
    );
  }

  async lockPendingBatch(limit: number, lockedBy: string, tenantId: string) {
    return this.query<DomainEvent>(
      `
        ;WITH PendingEvents AS (
          SELECT TOP (@Limit) *
          FROM events.DomainEvents WITH (UPDLOCK, READPAST, ROWLOCK)
          WHERE TenantId = @TenantId
            AND Status = 'PENDING'
            AND (NextAttemptAt IS NULL OR NextAttemptAt <= SYSUTCDATETIME())
            AND (LockedAt IS NULL OR LockedAt < DATEADD(MINUTE, -5, SYSUTCDATETIME()))
            AND RetryCount < MaxRetries
          ORDER BY CreatedAt ASC
        )
        UPDATE PendingEvents
        SET Status = 'PROCESSING',
            LockedAt = SYSUTCDATETIME(),
            LockedBy = @LockedBy,
            LastAttemptAt = SYSUTCDATETIME(),
            ErrorMessage = NULL
        OUTPUT ${eventOutputColumns}
      `,
      [
        { name: "Limit", value: limit },
        { name: "LockedBy", value: lockedBy },
        { name: "TenantId", value: tenantId }
      ]
    );
  }

  async markProcessing(eventId: string, lockedBy: string) {
    const result = await this.query<DomainEvent>(
      `
        UPDATE events.DomainEvents
        SET Status = 'PROCESSING',
            LockedAt = SYSUTCDATETIME(),
            LockedBy = @LockedBy,
            LastAttemptAt = SYSUTCDATETIME(),
            ErrorMessage = NULL
        OUTPUT ${eventOutputColumns}
        WHERE DomainEventId = @DomainEventId
          AND Status IN ('PENDING', 'FAILED')
      `,
      [
        { name: "DomainEventId", value: eventId },
        { name: "LockedBy", value: lockedBy }
      ]
    );

    return result[0];
  }

  async markProcessed(eventId: string) {
    const result = await this.query<DomainEvent>(
      `
        UPDATE events.DomainEvents
        SET Status = 'PROCESSED',
            ProcessedAt = SYSUTCDATETIME(),
            FailedAt = NULL,
            ErrorMessage = NULL,
            LockedAt = NULL,
            LockedBy = NULL,
            NextAttemptAt = NULL
        OUTPUT ${eventOutputColumns}
        WHERE DomainEventId = @DomainEventId
      `,
      [{ name: "DomainEventId", value: eventId }]
    );

    return result[0];
  }

  async markIgnored(eventId: string) {
    const result = await this.query<DomainEvent>(
      `
        UPDATE events.DomainEvents
        SET Status = 'IGNORED',
            ProcessedAt = SYSUTCDATETIME(),
            FailedAt = NULL,
            ErrorMessage = NULL,
            LockedAt = NULL,
            LockedBy = NULL,
            NextAttemptAt = NULL
        OUTPUT ${eventOutputColumns}
        WHERE DomainEventId = @DomainEventId
      `,
      [{ name: "DomainEventId", value: eventId }]
    );

    return result[0];
  }

  async markFailed(eventId: string, errorMessage: string) {
    const result = await this.query<DomainEvent>(
      `
        UPDATE events.DomainEvents
        SET Status = 'FAILED',
            FailedAt = SYSUTCDATETIME(),
            ErrorMessage = @ErrorMessage,
            RetryCount = RetryCount + 1,
            LockedAt = NULL,
            LockedBy = NULL,
            NextAttemptAt = NULL
        OUTPUT ${eventOutputColumns}
        WHERE DomainEventId = @DomainEventId
      `,
      [
        { name: "DomainEventId", value: eventId },
        { name: "ErrorMessage", value: errorMessage }
      ]
    );

    return result[0];
  }

  async releaseForRetry(eventId: string, errorMessage: string, nextAttemptAt: Date) {
    const result = await this.query<DomainEvent>(
      `
        UPDATE events.DomainEvents
        SET Status = 'PENDING',
            ErrorMessage = @ErrorMessage,
            RetryCount = RetryCount + 1,
            LockedAt = NULL,
            LockedBy = NULL,
            NextAttemptAt = @NextAttemptAt
        OUTPUT ${eventOutputColumns}
        WHERE DomainEventId = @DomainEventId
      `,
      [
        { name: "DomainEventId", value: eventId },
        { name: "ErrorMessage", value: errorMessage },
        { name: "NextAttemptAt", value: nextAttemptAt }
      ]
    );

    return result[0];
  }

  async getActiveSubscriptions(eventName: string, tenantId: string) {
    return this.query<EventSubscription>(
      `
        SELECT
          EventSubscriptionId AS eventSubscriptionId,
          TenantId AS tenantId,
          EventName AS eventName,
          SubscriberModule AS subscriberModule,
          SubscriberName AS subscriberName,
          IsActive AS isActive,
          CreatedAt AS createdAt,
          UpdatedAt AS updatedAt,
          CreatedBy AS createdBy,
          UpdatedBy AS updatedBy
        FROM events.EventSubscriptions
        WHERE EventName = @EventName
          AND IsActive = 1
          AND (TenantId = @TenantId OR TenantId IS NULL)
        ORDER BY CASE WHEN TenantId IS NULL THEN 0 ELSE 1 END,
                 SubscriberModule ASC,
                 SubscriberName ASC
      `,
      [
        { name: "EventName", value: eventName },
        { name: "TenantId", value: tenantId }
      ]
    );
  }
}
