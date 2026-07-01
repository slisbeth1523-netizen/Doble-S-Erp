import { z } from "zod";

const optionalUuidSchema = z.string().uuid().nullish();
const metadataSchema = z.record(z.string(), z.unknown()).optional();
const positivePageSchema = z.coerce.number().int().min(1).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(20);

export const domainEventStatusSchema = z.enum(["PENDING", "PROCESSED", "FAILED", "IGNORED"]);

export const domainEventIdParamsSchema = z.object({
  eventId: z.string().uuid()
});

export const domainEventQuerySchema = z.object({
  page: positivePageSchema,
  pageSize: pageSizeSchema,
  eventName: z.string().trim().min(1).max(160).optional(),
  status: domainEventStatusSchema.optional(),
  sourceModule: z.string().trim().min(1).max(120).optional()
});

export const domainEventPublishSchema = z.object({
  companyId: optionalUuidSchema,
  eventName: z.string().trim().min(1).max(160),
  eventType: z.string().trim().min(1).max(80),
  sourceModule: z.string().trim().min(1).max(120),
  sourceEntity: z.string().trim().min(1).max(160),
  sourceEntityId: z.string().trim().min(1).max(120),
  payload: metadataSchema,
  metadata: metadataSchema
});

export const eventSubscriptionCreateSchema = z.object({
  tenantId: optionalUuidSchema,
  eventName: z.string().trim().min(1).max(160),
  subscriberModule: z.string().trim().min(1).max(120),
  subscriberName: z.string().trim().min(1).max(160),
  isActive: z.boolean().optional()
});
