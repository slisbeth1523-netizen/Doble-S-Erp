import { BaseService } from "../../../services/BaseService.js";
import type {
  WorkflowEntityState,
  WorkflowHistoryQuery,
  WorkflowTransition,
  WorkflowTransitionExecutionContext
} from "../domain/workflow.types.js";
import { WorkflowHistoryRepository } from "../infrastructure/WorkflowHistoryRepository.js";

export class WorkflowHistoryService extends BaseService {
  constructor(private readonly repository = new WorkflowHistoryRepository()) {
    super();
  }

  registerInitialization(
    context: WorkflowTransitionExecutionContext,
    entityState: WorkflowEntityState,
    initialStateId: string
  ) {
    return this.repository.createHistoryEntry({
      tenantId: context.tenantId,
      companyId: context.companyId,
      workflowDefinitionId: context.workflowDefinitionId,
      entityStateId: entityState.entityStateId,
      entityName: context.entityName,
      entityId: context.entityId,
      transitionId: null,
      fromStateId: null,
      toStateId: initialStateId,
      actionCode: "WORKFLOW_INITIALIZED",
      createdBy: context.userId,
      requestId: context.requestId,
      correlationId: context.correlationId,
      metadata: {
        currentStateId: entityState.currentStateId
      }
    });
  }

  registerTransition(
    context: WorkflowTransitionExecutionContext,
    entityState: WorkflowEntityState,
    transition: WorkflowTransition,
    previousStateId: string,
    comment?: string | null
  ) {
    return this.repository.createHistoryEntry({
      tenantId: context.tenantId,
      companyId: context.companyId,
      workflowDefinitionId: context.workflowDefinitionId,
      entityStateId: entityState.entityStateId,
      entityName: context.entityName,
      entityId: context.entityId,
      transitionId: transition.workflowTransitionId,
      fromStateId: previousStateId,
      toStateId: transition.toStateId,
      actionCode: "WORKFLOW_TRANSITION_EXECUTED",
      comment,
      createdBy: context.userId,
      requestId: context.requestId,
      correlationId: context.correlationId,
      metadata: {
        transitionCode: transition.code,
        transitionName: transition.name
      }
    });
  }

  getEntityHistory(query: WorkflowHistoryQuery) {
    return this.repository.listByEntity(query);
  }

  getWorkflowHistory(query: WorkflowHistoryQuery) {
    return this.repository.listByWorkflow(query);
  }

  getEntityStateHistory(query: WorkflowHistoryQuery) {
    return this.repository.listByEntityState(query);
  }
}

export const workflowHistoryService = new WorkflowHistoryService();
