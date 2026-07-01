import { ConflictError } from "../../../errors/index.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import type {
  WorkflowContext,
  WorkflowExecutionResult,
  WorkflowTransitionExecutionContext
} from "../domain/workflow.types.js";
import { workflowHistoryService } from "./WorkflowHistoryService.js";
import { WorkflowDefinitionRepository } from "../infrastructure/WorkflowDefinitionRepository.js";
import { WorkflowExecutionRepository } from "../infrastructure/WorkflowExecutionRepository.js";
import { WorkflowStateRepository } from "../infrastructure/WorkflowStateRepository.js";

export class WorkflowExecutionService extends BaseService {
  constructor(
    private readonly repository = new WorkflowExecutionRepository(),
    private readonly definitionRepository = new WorkflowDefinitionRepository(),
    private readonly stateRepository = new WorkflowStateRepository()
  ) {
    super();
  }

  async getEntityState(context: WorkflowTransitionExecutionContext) {
    await this.ensureDefinitionExists(context, context.workflowDefinitionId);
    const entityState = await this.repository.getCurrentEntityState(
      context.tenantId,
      context.workflowDefinitionId,
      context.entityName,
      context.entityId
    );

    return this.ensureFound(entityState, "Workflow entity state not found");
  }

  async initializeEntityState(
    context: WorkflowTransitionExecutionContext,
    initialStateId: string
  ) {
    await this.ensureDefinitionExists(context, context.workflowDefinitionId);
    await this.ensureStateExists(context, context.workflowDefinitionId, initialStateId);
    const currentState = await this.repository.getCurrentEntityState(
      context.tenantId,
      context.workflowDefinitionId,
      context.entityName,
      context.entityId
    );

    if (currentState) {
      throw new ConflictError(
        "Workflow entity state is already initialized",
        undefined,
        "WORKFLOW_ENTITY_STATE_ALREADY_INITIALIZED"
      );
    }

    const entityState = await this.repository.createInitialEntityState({
      tenantId: context.tenantId,
      companyId: context.companyId,
      workflowDefinitionId: context.workflowDefinitionId,
      entityName: context.entityName,
      entityId: context.entityId,
      initialStateId,
      userId: context.userId
    });
    const found = this.ensureFound(entityState, "Workflow entity state could not be initialized");

    logger.info("Workflow entity state initialized", {
      tenantId: context.tenantId,
      workflowDefinitionId: context.workflowDefinitionId,
      entityName: context.entityName,
      entityId: context.entityId,
      currentStateId: found.currentStateId
    });
    await this.auditInitialized(context, found.entityStateId, initialStateId);
    await this.registerHistorySafely("initialization", () =>
      workflowHistoryService.registerInitialization(context, found, initialStateId)
    );

    return found;
  }

  async executeTransition(
    context: WorkflowTransitionExecutionContext,
    transitionId: string,
    comment?: string | null
  ): Promise<WorkflowExecutionResult> {
    await this.ensureDefinitionExists(context, context.workflowDefinitionId);
    const currentState = await this.repository.getCurrentEntityState(
      context.tenantId,
      context.workflowDefinitionId,
      context.entityName,
      context.entityId
    );

    if (!currentState) {
      throw new ConflictError(
        "Workflow entity state has not been initialized",
        undefined,
        "WORKFLOW_ENTITY_STATE_NOT_INITIALIZED"
      );
    }

    const transition = await this.repository.getValidTransition(
      context.tenantId,
      context.workflowDefinitionId,
      transitionId,
      currentState.currentStateId
    );

    if (!transition) {
      await this.ensureTransitionFailureReason(context, transitionId, currentState.currentStateId);
    }

    const validTransition = this.ensureFound(transition, "Workflow transition not found");
    const updatedState = await this.repository.updateCurrentEntityState({
      tenantId: context.tenantId,
      workflowDefinitionId: context.workflowDefinitionId,
      entityName: context.entityName,
      entityId: context.entityId,
      expectedCurrentStateId: currentState.currentStateId,
      newStateId: validTransition.toStateId,
      userId: context.userId
    });
    const found = this.ensureFound(updatedState, "Workflow entity state could not be updated");

    logger.info("Workflow transition executed", {
      tenantId: context.tenantId,
      workflowDefinitionId: context.workflowDefinitionId,
      entityName: context.entityName,
      entityId: context.entityId,
      transitionId
    });
    await this.auditExecuted(context, found.entityStateId, validTransition.workflowTransitionId, {
      previousStateId: currentState.currentStateId,
      newStateId: validTransition.toStateId,
      comment
    });
    await this.registerHistorySafely("transition", () =>
      workflowHistoryService.registerTransition(
        context,
        found,
        validTransition,
        currentState.currentStateId,
        comment
      )
    );

    return {
      entityState: found,
      previousStateId: currentState.currentStateId,
      newStateId: validTransition.toStateId,
      transition: validTransition
    };
  }

  private async ensureDefinitionExists(context: WorkflowContext, workflowDefinitionId: string) {
    const definition = await this.definitionRepository.findById(context.tenantId, workflowDefinitionId);
    return this.ensureFound(definition, "Workflow definition not found");
  }

  private async ensureStateExists(
    context: WorkflowContext,
    workflowDefinitionId: string,
    workflowStateId: string
  ) {
    const state = await this.stateRepository.findById(
      context.tenantId,
      workflowDefinitionId,
      workflowStateId
    );
    return this.ensureFound(state, "Workflow state not found");
  }

  private async ensureTransitionFailureReason(
    context: WorkflowTransitionExecutionContext,
    transitionId: string,
    currentStateId: string
  ): Promise<never> {
    const transition = await this.repository.findTransitionById(
      context.tenantId,
      context.workflowDefinitionId,
      transitionId
    );

    if (!transition) {
      throw new ConflictError(
        "Workflow transition does not belong to the current tenant or workflow",
        undefined,
        "WORKFLOW_TRANSITION_NOT_AVAILABLE"
      );
    }

    if (!transition.isActive) {
      throw new ConflictError("Workflow transition is inactive", undefined, "WORKFLOW_TRANSITION_INACTIVE");
    }

    if (transition.fromStateId !== currentStateId) {
      throw new ConflictError(
        "Workflow transition does not match the current state",
        undefined,
        "WORKFLOW_TRANSITION_STATE_MISMATCH"
      );
    }

    throw new ConflictError("Workflow transition is not valid", undefined, "WORKFLOW_TRANSITION_INVALID");
  }

  private auditInitialized(
    context: WorkflowTransitionExecutionContext,
    entityStateId: string,
    initialStateId: string
  ) {
    return auditEvent({
      tenantId: context.tenantId,
      companyId: context.companyId,
      userId: context.userId,
      action: "WORKFLOW_ENTITY_STATE_INITIALIZED",
      entity: "workflow.EntityStates",
      entityId: entityStateId,
      metadata: {
        workflowDefinitionId: context.workflowDefinitionId,
        entityName: context.entityName,
        entityId: context.entityId,
        initialStateId,
        requestId: context.requestId,
        correlationId: context.correlationId
      }
    });
  }

  private auditExecuted(
    context: WorkflowTransitionExecutionContext,
    entityStateId: string,
    transitionId: string,
    metadata: { previousStateId: string; newStateId: string; comment?: string | null }
  ) {
    return auditEvent({
      tenantId: context.tenantId,
      companyId: context.companyId,
      userId: context.userId,
      action: "WORKFLOW_TRANSITION_EXECUTED",
      entity: "workflow.EntityStates",
      entityId: entityStateId,
      metadata: {
        workflowDefinitionId: context.workflowDefinitionId,
        entityName: context.entityName,
        entityId: context.entityId,
        transitionId,
        ...metadata,
        requestId: context.requestId,
        correlationId: context.correlationId
      }
    });
  }

  private async registerHistorySafely(action: string, callback: () => Promise<unknown>) {
    try {
      await callback();
    } catch {
      // TODO: move workflow state update and history insert into one strong transaction.
      logger.warn("Workflow history entry could not be recorded", { action });
    }
  }
}

export const workflowExecutionService = new WorkflowExecutionService();
