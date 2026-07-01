import { ConflictError } from "../../../errors/index.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import type { WorkflowContext, WorkflowStateCreateInput } from "../domain/workflow.types.js";
import { WorkflowDefinitionRepository } from "../infrastructure/WorkflowDefinitionRepository.js";
import { WorkflowStateRepository } from "../infrastructure/WorkflowStateRepository.js";

export class WorkflowStateService extends BaseService {
  constructor(
    private readonly repository = new WorkflowStateRepository(),
    private readonly definitionRepository = new WorkflowDefinitionRepository()
  ) {
    super();
  }

  async list(context: WorkflowContext, workflowDefinitionId: string) {
    await this.ensureDefinitionExists(context, workflowDefinitionId);
    return this.repository.listByDefinition(context.tenantId, workflowDefinitionId);
  }

  async create(context: WorkflowContext, workflowDefinitionId: string, input: WorkflowStateCreateInput) {
    await this.ensureDefinitionExists(context, workflowDefinitionId);
    await this.ensureUniqueCode(context.tenantId, workflowDefinitionId, input.code);
    const state = await this.repository.create(
      context.tenantId,
      workflowDefinitionId,
      input,
      context.userId
    );
    const found = this.ensureFound(state, "Workflow state could not be created");

    logger.info("Workflow state created", {
      tenantId: context.tenantId,
      workflowDefinitionId,
      workflowStateId: found.workflowStateId
    });
    await this.audit(context, workflowDefinitionId, found.workflowStateId);

    return found;
  }

  private async ensureDefinitionExists(context: WorkflowContext, workflowDefinitionId: string) {
    const definition = await this.definitionRepository.findById(context.tenantId, workflowDefinitionId);
    return this.ensureFound(definition, "Workflow definition not found");
  }

  private async ensureUniqueCode(tenantId: string, workflowDefinitionId: string, code: string) {
    const exists = await this.repository.codeExists(tenantId, workflowDefinitionId, code);

    if (exists) {
      throw new ConflictError("Workflow state code already exists", undefined, "WORKFLOW_STATE_CODE_EXISTS");
    }
  }

  private audit(context: WorkflowContext, workflowDefinitionId: string, workflowStateId: string) {
    return auditEvent({
      tenantId: context.tenantId,
      companyId: context.companyId,
      userId: context.userId,
      action: "WORKFLOW_STATE_CREATED",
      entity: "workflow.States",
      entityId: workflowStateId,
      metadata: {
        workflowDefinitionId,
        requestId: context.requestId,
        correlationId: context.correlationId
      }
    });
  }
}

export const workflowStateService = new WorkflowStateService();
