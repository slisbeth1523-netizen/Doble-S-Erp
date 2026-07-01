import { ConflictError } from "../../../errors/index.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import type { WorkflowConditionCreateInput, WorkflowContext } from "../domain/workflow.types.js";
import { WorkflowConditionRepository } from "../infrastructure/WorkflowConditionRepository.js";
import { WorkflowDefinitionRepository } from "../infrastructure/WorkflowDefinitionRepository.js";
import { WorkflowExecutionRepository } from "../infrastructure/WorkflowExecutionRepository.js";

export class WorkflowConditionService extends BaseService {
  constructor(
    private readonly repository = new WorkflowConditionRepository(),
    private readonly definitionRepository = new WorkflowDefinitionRepository(),
    private readonly executionRepository = new WorkflowExecutionRepository()
  ) {
    super();
  }

  async listByTransition(context: WorkflowContext, workflowDefinitionId: string, transitionId: string) {
    await this.ensureWorkflowAndTransition(context, workflowDefinitionId, transitionId);
    return this.repository.listByTransition(context.tenantId, workflowDefinitionId, transitionId);
  }

  async getActiveByTransition(context: WorkflowContext, workflowDefinitionId: string, transitionId: string) {
    return this.repository.getActiveByTransition(context.tenantId, workflowDefinitionId, transitionId);
  }

  async create(
    context: WorkflowContext,
    workflowDefinitionId: string,
    transitionId: string,
    input: WorkflowConditionCreateInput
  ) {
    await this.ensureWorkflowAndTransition(context, workflowDefinitionId, transitionId);
    await this.ensureUniqueCode(context.tenantId, workflowDefinitionId, transitionId, input.code);
    const condition = await this.repository.create(
      context.tenantId,
      workflowDefinitionId,
      transitionId,
      input,
      context.userId
    );
    const found = this.ensureFound(condition, "Workflow condition could not be created");
    await auditEvent({
      tenantId: context.tenantId,
      companyId: context.companyId,
      userId: context.userId,
      action: "WORKFLOW_CONDITION_CREATED",
      entity: "workflow.Conditions",
      entityId: found.workflowConditionId,
      metadata: { workflowDefinitionId, transitionId, requestId: context.requestId }
    });

    return found;
  }

  private async ensureWorkflowAndTransition(
    context: WorkflowContext,
    workflowDefinitionId: string,
    transitionId: string
  ) {
    const definition = await this.definitionRepository.findById(context.tenantId, workflowDefinitionId);
    this.ensureFound(definition, "Workflow definition not found");
    const transition = await this.executionRepository.findTransitionById(
      context.tenantId,
      workflowDefinitionId,
      transitionId
    );
    return this.ensureFound(transition, "Workflow transition not found");
  }

  private async ensureUniqueCode(
    tenantId: string,
    workflowDefinitionId: string,
    transitionId: string,
    code: string
  ) {
    const exists = await this.repository.codeExists(tenantId, workflowDefinitionId, transitionId, code);

    if (exists) {
      throw new ConflictError(
        "Workflow condition code already exists",
        undefined,
        "WORKFLOW_CONDITION_CODE_EXISTS"
      );
    }
  }
}

export const workflowConditionService = new WorkflowConditionService();
