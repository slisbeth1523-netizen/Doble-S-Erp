import { ConflictError } from "../../../errors/index.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import type {
  WorkflowContext,
  WorkflowTransitionCreateInput
} from "../domain/workflow.types.js";
import { WorkflowDefinitionRepository } from "../infrastructure/WorkflowDefinitionRepository.js";
import { WorkflowStateRepository } from "../infrastructure/WorkflowStateRepository.js";
import { WorkflowTransitionRepository } from "../infrastructure/WorkflowTransitionRepository.js";

export class WorkflowTransitionService extends BaseService {
  constructor(
    private readonly repository = new WorkflowTransitionRepository(),
    private readonly definitionRepository = new WorkflowDefinitionRepository(),
    private readonly stateRepository = new WorkflowStateRepository()
  ) {
    super();
  }

  async list(context: WorkflowContext, workflowDefinitionId: string) {
    await this.ensureDefinitionExists(context, workflowDefinitionId);
    return this.repository.listByDefinition(context.tenantId, workflowDefinitionId);
  }

  async create(
    context: WorkflowContext,
    workflowDefinitionId: string,
    input: WorkflowTransitionCreateInput
  ) {
    await this.ensureDefinitionExists(context, workflowDefinitionId);
    this.ensureBusinessRule(
      input.fromStateId !== input.toStateId,
      "Workflow transition origin and destination must be different",
      "WORKFLOW_TRANSITION_SAME_STATE"
    );
    await this.ensureStateExists(context, workflowDefinitionId, input.fromStateId, "Origin workflow state not found");
    await this.ensureStateExists(context, workflowDefinitionId, input.toStateId, "Destination workflow state not found");
    await this.ensureUniqueCode(context.tenantId, workflowDefinitionId, input.code);

    const transition = await this.repository.create(
      context.tenantId,
      workflowDefinitionId,
      input,
      context.userId
    );
    const found = this.ensureFound(transition, "Workflow transition could not be created");

    logger.info("Workflow transition created", {
      tenantId: context.tenantId,
      workflowDefinitionId,
      workflowTransitionId: found.workflowTransitionId
    });
    await this.audit(context, workflowDefinitionId, found.workflowTransitionId);

    return found;
  }

  private async ensureDefinitionExists(context: WorkflowContext, workflowDefinitionId: string) {
    const definition = await this.definitionRepository.findById(context.tenantId, workflowDefinitionId);
    return this.ensureFound(definition, "Workflow definition not found");
  }

  private async ensureStateExists(
    context: WorkflowContext,
    workflowDefinitionId: string,
    workflowStateId: string,
    message: string
  ) {
    const state = await this.stateRepository.findById(
      context.tenantId,
      workflowDefinitionId,
      workflowStateId
    );
    return this.ensureFound(state, message);
  }

  private async ensureUniqueCode(tenantId: string, workflowDefinitionId: string, code: string) {
    const exists = await this.repository.codeExists(tenantId, workflowDefinitionId, code);

    if (exists) {
      throw new ConflictError(
        "Workflow transition code already exists",
        undefined,
        "WORKFLOW_TRANSITION_CODE_EXISTS"
      );
    }
  }

  private audit(context: WorkflowContext, workflowDefinitionId: string, workflowTransitionId: string) {
    return auditEvent({
      tenantId: context.tenantId,
      companyId: context.companyId,
      userId: context.userId,
      action: "WORKFLOW_TRANSITION_CREATED",
      entity: "workflow.Transitions",
      entityId: workflowTransitionId,
      metadata: {
        workflowDefinitionId,
        requestId: context.requestId,
        correlationId: context.correlationId
      }
    });
  }
}

export const workflowTransitionService = new WorkflowTransitionService();
