import { Router } from "express";

import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { getRequestContext } from "../../../../utils/requestContext.js";
import { sendSuccess } from "../../../../utils/responseBuilder.js";
import { validateRequest } from "../../../../utils/validateRequest.js";
import { requireTenantContext } from "../../../core/api/tenant-context.middleware.js";
import { requireAuth } from "../../../security/api/auth.middleware.js";
import { requirePermission } from "../../../security/api/permission.middleware.js";
import { domainEventService } from "../../application/DomainEventService.js";
import { eventSubscriptionService } from "../../application/EventSubscriptionService.js";
import type { DomainEventStatus, EventContext } from "../../domain/events.types.js";
import {
  domainEventIdParamsSchema,
  domainEventPublishSchema,
  domainEventQuerySchema,
  eventSubscriptionCreateSchema
} from "../../validators/events.validators.js";

export const eventsRouter = Router();

eventsRouter.use(requireAuth, requireTenantContext);

function eventContext(request: Parameters<typeof getRequestContext>[0]): EventContext {
  const context = getRequestContext(request);

  return {
    tenantId: request.tenantContext!.tenantId,
    companyId: request.tenantContext?.companyId ?? context.companyId,
    userId: context.userId,
    requestId: context.requestId,
    correlationId: context.correlationId
  };
}

function paginationQuery(request: Parameters<typeof getRequestContext>[0]) {
  const page = Number(request.query.page ?? 1);
  const pageSize = Number(request.query.pageSize ?? 20);

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize
  };
}

eventsRouter.get(
  "/",
  validateRequest({ query: domainEventQuerySchema }),
  requirePermission("events", "events.read"),
  asyncHandler(async (request, response) => {
    const context = eventContext(request);
    const pagination = paginationQuery(request);
    const result = await domainEventService.list({
      tenantId: context.tenantId,
      eventName: typeof request.query.eventName === "string" ? request.query.eventName : undefined,
      status:
        typeof request.query.status === "string"
          ? (request.query.status as DomainEventStatus)
          : undefined,
      sourceModule:
        typeof request.query.sourceModule === "string" ? request.query.sourceModule : undefined,
      ...pagination
    });

    sendSuccess(response, result.items, 200, undefined, {
      pagination: { ...pagination, totalItems: result.totalItems }
    });
  })
);

eventsRouter.post(
  "/publish",
  validateRequest({ body: domainEventPublishSchema }),
  requirePermission("events", "events.publish"),
  asyncHandler(async (request, response) => {
    const event = await domainEventService.publish(eventContext(request), request.body);
    sendSuccess(response, event, 201);
  })
);

eventsRouter.get(
  "/subscriptions",
  requirePermission("events", "events.subscriptions.read"),
  asyncHandler(async (request, response) => {
    const subscriptions = await eventSubscriptionService.list(eventContext(request));
    sendSuccess(response, subscriptions);
  })
);

eventsRouter.post(
  "/subscriptions",
  validateRequest({ body: eventSubscriptionCreateSchema }),
  requirePermission("events", "events.subscriptions.create"),
  asyncHandler(async (request, response) => {
    const subscription = await eventSubscriptionService.create(eventContext(request), request.body);
    sendSuccess(response, subscription, 201);
  })
);

eventsRouter.get(
  "/:eventId",
  validateRequest({ params: domainEventIdParamsSchema }),
  requirePermission("events", "events.read"),
  asyncHandler(async (request, response) => {
    const event = await domainEventService.getById(eventContext(request), request.params.eventId!);
    sendSuccess(response, event);
  })
);
