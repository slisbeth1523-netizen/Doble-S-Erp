import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import type {
  WorkflowAction,
  WorkflowActionExecution,
  WorkflowActionPreparationContext,
  WorkflowActionPreparationResult,
  WorkflowActionExecutionStatus
} from "../domain/workflow.types.js";
import { workflowActionExecutionService } from "./WorkflowActionExecutionService.js";
import { workflowActionService } from "./WorkflowActionService.js";

function parsePayloadTemplate(action: WorkflowAction) {
  if (!action.payloadTemplateJson) {
    return undefined;
  }

  try {
    return JSON.parse(action.payloadTemplateJson) as Record<string, unknown>;
  } catch {
    return { invalidTemplate: true };
  }
}

function statusForAction(action: WorkflowAction): WorkflowActionExecutionStatus {
  return action.actionType === "AUDIT" ? "PREPARED" : "PENDING";
}

export class WorkflowActionDispatcherService {
  async prepareActionsAfterTransition(
    context: WorkflowActionPreparationContext
  ): Promise<WorkflowActionPreparationResult> {
    const actions = await workflowActionService.getActiveByTransition(
      context,
      context.workflowDefinitionId,
      context.transition.workflowTransitionId
    );
    const prepared: WorkflowActionExecution[] = [];
    const failed: Array<{ action: WorkflowAction; errorMessage: string }> = [];

    for (const action of actions) {
      try {
        const execution = await workflowActionExecutionService.createPreparedExecution({
          tenantId: context.tenantId,
          companyId: context.companyId,
          workflowActionId: action.workflowActionId,
          workflowDefinitionId: context.workflowDefinitionId,
          transitionId: context.transition.workflowTransitionId,
          entityStateId: context.entityState.entityStateId,
          entityName: context.entityName,
          entityId: context.entityId,
          status: statusForAction(action),
          actionType: action.actionType,
          executionMode: action.executionMode,
          payload: {
            template: parsePayloadTemplate(action),
            transition: {
              id: context.transition.workflowTransitionId,
              code: context.transition.code,
              toStateId: context.transition.toStateId
            },
            entity: {
              name: context.entityName,
              id: context.entityId
            }
          },
          createdBy: context.userId,
          requestId: context.requestId,
          correlationId: context.correlationId
        });
        prepared.push(execution);
        logger.info("Workflow action execution prepared", {
          tenantId: context.tenantId,
          workflowActionId: action.workflowActionId,
          status: execution.status
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Workflow action dispatch failed";
        failed.push({ action, errorMessage });
        logger.warn("Workflow action dispatch failed", {
          tenantId: context.tenantId,
          workflowActionId: action.workflowActionId,
          errorMessage
        });
        await auditEvent({
          tenantId: context.tenantId,
          companyId: context.companyId,
          userId: context.userId,
          action: "WORKFLOW_ACTION_DISPATCH_FAILED",
          entity: "workflow.Actions",
          entityId: action.workflowActionId,
          metadata: {
            workflowDefinitionId: context.workflowDefinitionId,
            transitionId: context.transition.workflowTransitionId,
            entityName: context.entityName,
            entityId: context.entityId,
            errorMessage
          }
        });

        try {
          await workflowActionExecutionService.createPreparedExecution({
            tenantId: context.tenantId,
            companyId: context.companyId,
            workflowActionId: action.workflowActionId,
            workflowDefinitionId: context.workflowDefinitionId,
            transitionId: context.transition.workflowTransitionId,
            entityStateId: context.entityState.entityStateId,
            entityName: context.entityName,
            entityId: context.entityId,
            status: "FAILED",
            actionType: action.actionType,
            executionMode: action.executionMode,
            errorMessage,
            createdBy: context.userId,
            requestId: context.requestId,
            correlationId: context.correlationId
          });
        } catch {
          logger.warn("Workflow failed action execution record could not be created", {
            workflowActionId: action.workflowActionId
          });
        }
      }
    }

    return { prepared, failed };
  }
}

export const workflowActionDispatcherService = new WorkflowActionDispatcherService();
