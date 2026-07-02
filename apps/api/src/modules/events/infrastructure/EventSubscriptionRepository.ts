import { BaseSqlRepository } from "../../../repositories/BaseSqlRepository.js";
import type { EventSubscription, EventSubscriptionCreateInput } from "../domain/events.types.js";

const subscriptionColumns = `
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
`;

const subscriptionOutputColumns = `
  inserted.EventSubscriptionId AS eventSubscriptionId,
  inserted.TenantId AS tenantId,
  inserted.EventName AS eventName,
  inserted.SubscriberModule AS subscriberModule,
  inserted.SubscriberName AS subscriberName,
  inserted.IsActive AS isActive,
  inserted.CreatedAt AS createdAt,
  inserted.UpdatedAt AS updatedAt,
  inserted.CreatedBy AS createdBy,
  inserted.UpdatedBy AS updatedBy
`;

export class EventSubscriptionRepository extends BaseSqlRepository {
  async list(tenantId: string) {
    return this.query<EventSubscription>(
      `
        SELECT ${subscriptionColumns}
        FROM events.EventSubscriptions
        WHERE TenantId = @TenantId
           OR TenantId IS NULL
        ORDER BY EventName ASC, SubscriberModule ASC, SubscriberName ASC
      `,
      [{ name: "TenantId", value: tenantId }]
    );
  }

  async create(input: EventSubscriptionCreateInput, createdBy?: string) {
    const result = await this.query<EventSubscription>(
      `
        INSERT INTO events.EventSubscriptions (
          TenantId,
          EventName,
          SubscriberModule,
          SubscriberName,
          IsActive,
          CreatedBy
        )
        OUTPUT ${subscriptionOutputColumns}
        VALUES (
          @TenantId,
          @EventName,
          @SubscriberModule,
          @SubscriberName,
          @IsActive,
          @CreatedBy
        )
      `,
      [
        { name: "TenantId", value: input.tenantId ?? null },
        { name: "EventName", value: input.eventName },
        { name: "SubscriberModule", value: input.subscriberModule },
        { name: "SubscriberName", value: input.subscriberName },
        { name: "IsActive", value: input.isActive ?? true },
        { name: "CreatedBy", value: createdBy ?? null }
      ]
    );

    return result[0];
  }

  async subscriptionExists(input: EventSubscriptionCreateInput) {
    const result = await this.query<{ existsFlag: number }>(
      `
        SELECT TOP 1 1 AS existsFlag
        FROM events.EventSubscriptions
        WHERE EventName = @EventName
          AND SubscriberModule = @SubscriberModule
          AND SubscriberName = @SubscriberName
          AND (
            (TenantId = @TenantId)
            OR (TenantId IS NULL AND @TenantId IS NULL)
          )
      `,
      [
        { name: "TenantId", value: input.tenantId ?? null },
        { name: "EventName", value: input.eventName },
        { name: "SubscriberModule", value: input.subscriberModule },
        { name: "SubscriberName", value: input.subscriberName }
      ]
    );

    return Boolean(result[0]);
  }
}
