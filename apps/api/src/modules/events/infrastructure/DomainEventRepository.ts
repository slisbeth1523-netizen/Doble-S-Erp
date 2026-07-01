import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  DomainEvent,
  DomainEventCreateInput,
  DomainEventListResult,
  DomainEventQuery
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
}
