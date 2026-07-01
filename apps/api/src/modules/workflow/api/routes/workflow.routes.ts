import { Router } from "express";

import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { getRequestContext } from "../../../../utils/requestContext.js";
import { sendSuccess } from "../../../../utils/responseBuilder.js";
import { validateRequest } from "../../../../utils/validateRequest.js";
import { requireTenantContext } from "../../../core/api/tenant-context.middleware.js";
import { requireAuth } from "../../../security/api/auth.middleware.js";
import { requirePermission } from "../../../security/api/permission.middleware.js";
import { workflowConditionService } from "../../application/WorkflowConditionService.js";
import { workflowDefinitionService } from "../../application/WorkflowDefinitionService.js";
import { workflowExecutionService } from "../../application/WorkflowExecutionService.js";
import { workflowGuardService } from "../../application/WorkflowGuardService.js";
import { workflowHistoryService } from "../../application/WorkflowHistoryService.js";
import { workflowStateService } from "../../application/WorkflowStateService.js";
import { workflowTransitionService } from "../../application/WorkflowTransitionService.js";
import type { WorkflowContext, WorkflowTransitionExecutionContext } from "../../domain/workflow.types.js";
import {
  workflowEntityInitializeSchema,
  workflowEntityParamsSchema,
  workflowEntityTransitionSchema,
  workflowConditionCreateSchema,
  workflowGuardCreateSchema,
  workflowHistoryQuerySchema,
  workflowCreateSchema,
  workflowIdParamsSchema,
  workflowStateCreateSchema,
  workflowTransitionParamsSchema,
  workflowTransitionCreateSchema
} from "../../validators/workflow.validators.js";

export const workflowRouter = Router();

workflowRouter.use(requireAuth, requireTenantContext);

function workflowContext(request: Parameters<typeof getRequestContext>[0]): WorkflowContext {
  const context = getRequestContext(request);

  return {
    tenantId: request.tenantContext!.tenantId,
    companyId: request.tenantContext?.companyId ?? context.companyId,
    userId: context.userId,
    requestId: context.requestId,
    correlationId: context.correlationId
  };
}

function workflowExecutionContext(
  request: Parameters<typeof getRequestContext>[0]
): WorkflowTransitionExecutionContext {
  const context = workflowContext(request);

  return {
    ...context,
    workflowDefinitionId: request.params.workflowId!,
    entityName: request.params.entityName!,
    entityId: request.params.entityId!
  };
}

function historyQuery(request: Parameters<typeof getRequestContext>[0]) {
  const page = Number(request.query.page ?? 1);
  const pageSize = Number(request.query.pageSize ?? 20);

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    from: typeof request.query.from === "string" ? request.query.from : undefined,
    to: typeof request.query.to === "string" ? request.query.to : undefined
  };
}

workflowRouter.get(
  "/",
  requirePermission("workflow", "workflow.definitions.read"),
  asyncHandler(async (request, response) => {
    const definitions = await workflowDefinitionService.list(workflowContext(request));
    sendSuccess(response, definitions);
  })
);

workflowRouter.post(
  "/",
  validateRequest({ body: workflowCreateSchema }),
  requirePermission("workflow", "workflow.definitions.create"),
  asyncHandler(async (request, response) => {
    const definition = await workflowDefinitionService.create(workflowContext(request), request.body);
    sendSuccess(response, definition, 201);
  })
);

workflowRouter.get(
  "/:workflowId",
  validateRequest({ params: workflowIdParamsSchema }),
  requirePermission("workflow", "workflow.definitions.read"),
  asyncHandler(async (request, response) => {
    const definition = await workflowDefinitionService.getById(
      workflowContext(request),
      request.params.workflowId!
    );
    sendSuccess(response, definition);
  })
);

workflowRouter.get(
  "/:workflowId/entities/:entityName/:entityId/history",
  validateRequest({ params: workflowEntityParamsSchema, query: workflowHistoryQuerySchema }),
  requirePermission("workflow", "workflow.history.read"),
  asyncHandler(async (request, response) => {
    const context = workflowExecutionContext(request);
    const result = await workflowHistoryService.getEntityHistory({
      tenantId: context.tenantId,
      workflowDefinitionId: context.workflowDefinitionId,
      entityName: context.entityName,
      entityId: context.entityId,
      ...historyQuery(request)
    });

    sendSuccess(response, result.items, 200, undefined, {
      pagination: {
        page: Number(request.query.page ?? 1),
        pageSize: Number(request.query.pageSize ?? 20),
        totalItems: result.totalItems
      }
    });
  })
);

workflowRouter.get(
  "/:workflowId/entities/:entityName/:entityId/state",
  validateRequest({ params: workflowEntityParamsSchema }),
  requirePermission("workflow", "workflow.execution.read"),
  asyncHandler(async (request, response) => {
    const state = await workflowExecutionService.getEntityState(workflowExecutionContext(request));
    sendSuccess(response, state);
  })
);

workflowRouter.post(
  "/:workflowId/entities/:entityName/:entityId/initialize",
  validateRequest({ params: workflowEntityParamsSchema, body: workflowEntityInitializeSchema }),
  requirePermission("workflow", "workflow.execution.initialize"),
  asyncHandler(async (request, response) => {
    const state = await workflowExecutionService.initializeEntityState(
      workflowExecutionContext(request),
      request.body.initialStateId
    );
    sendSuccess(response, state, 201);
  })
);

workflowRouter.post(
  "/:workflowId/entities/:entityName/:entityId/transition",
  validateRequest({ params: workflowEntityParamsSchema, body: workflowEntityTransitionSchema }),
  requirePermission("workflow", "workflow.execution.transition"),
  asyncHandler(async (request, response) => {
    const result = await workflowExecutionService.executeTransition(
      workflowExecutionContext(request),
      request.body.transitionId,
      request.body.comment,
      request.body.entityData
    );
    sendSuccess(response, result);
  })
);

workflowRouter.get(
  "/:workflowId/transitions/:transitionId/guards",
  validateRequest({ params: workflowTransitionParamsSchema }),
  requirePermission("workflow", "workflow.guards.read"),
  asyncHandler(async (request, response) => {
    const guards = await workflowGuardService.listByTransition(
      workflowContext(request),
      request.params.workflowId!,
      request.params.transitionId!
    );
    sendSuccess(response, guards);
  })
);

workflowRouter.post(
  "/:workflowId/transitions/:transitionId/guards",
  validateRequest({ params: workflowTransitionParamsSchema, body: workflowGuardCreateSchema }),
  requirePermission("workflow", "workflow.guards.create"),
  asyncHandler(async (request, response) => {
    const guard = await workflowGuardService.create(
      workflowContext(request),
      request.params.workflowId!,
      request.params.transitionId!,
      request.body
    );
    sendSuccess(response, guard, 201);
  })
);

workflowRouter.get(
  "/:workflowId/transitions/:transitionId/conditions",
  validateRequest({ params: workflowTransitionParamsSchema }),
  requirePermission("workflow", "workflow.conditions.read"),
  asyncHandler(async (request, response) => {
    const conditions = await workflowConditionService.listByTransition(
      workflowContext(request),
      request.params.workflowId!,
      request.params.transitionId!
    );
    sendSuccess(response, conditions);
  })
);

workflowRouter.post(
  "/:workflowId/transitions/:transitionId/conditions",
  validateRequest({ params: workflowTransitionParamsSchema, body: workflowConditionCreateSchema }),
  requirePermission("workflow", "workflow.conditions.create"),
  asyncHandler(async (request, response) => {
    const condition = await workflowConditionService.create(
      workflowContext(request),
      request.params.workflowId!,
      request.params.transitionId!,
      request.body
    );
    sendSuccess(response, condition, 201);
  })
);

workflowRouter.get(
  "/:workflowId/history",
  validateRequest({ params: workflowIdParamsSchema, query: workflowHistoryQuerySchema }),
  requirePermission("workflow", "workflow.history.read"),
  asyncHandler(async (request, response) => {
    const context = workflowContext(request);
    const result = await workflowHistoryService.getWorkflowHistory({
      tenantId: context.tenantId,
      workflowDefinitionId: request.params.workflowId!,
      ...historyQuery(request)
    });

    sendSuccess(response, result.items, 200, undefined, {
      pagination: {
        page: Number(request.query.page ?? 1),
        pageSize: Number(request.query.pageSize ?? 20),
        totalItems: result.totalItems
      }
    });
  })
);

workflowRouter.get(
  "/:workflowId/states",
  validateRequest({ params: workflowIdParamsSchema }),
  requirePermission("workflow", "workflow.states.read"),
  asyncHandler(async (request, response) => {
    const states = await workflowStateService.list(workflowContext(request), request.params.workflowId!);
    sendSuccess(response, states);
  })
);

workflowRouter.post(
  "/:workflowId/states",
  validateRequest({ params: workflowIdParamsSchema, body: workflowStateCreateSchema }),
  requirePermission("workflow", "workflow.states.create"),
  asyncHandler(async (request, response) => {
    const state = await workflowStateService.create(
      workflowContext(request),
      request.params.workflowId!,
      request.body
    );
    sendSuccess(response, state, 201);
  })
);

workflowRouter.get(
  "/:workflowId/transitions",
  validateRequest({ params: workflowIdParamsSchema }),
  requirePermission("workflow", "workflow.transitions.read"),
  asyncHandler(async (request, response) => {
    const transitions = await workflowTransitionService.list(
      workflowContext(request),
      request.params.workflowId!
    );
    sendSuccess(response, transitions);
  })
);

workflowRouter.post(
  "/:workflowId/transitions",
  validateRequest({ params: workflowIdParamsSchema, body: workflowTransitionCreateSchema }),
  requirePermission("workflow", "workflow.transitions.create"),
  asyncHandler(async (request, response) => {
    const transition = await workflowTransitionService.create(
      workflowContext(request),
      request.params.workflowId!,
      request.body
    );
    sendSuccess(response, transition, 201);
  })
);
