import { ConflictError } from "../../../errors/index.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import type {
  WorkflowContext,
  WorkflowDefinitionCreateInput
} from "../domain/workflow.types.js";
import { WorkflowDefinitionRepository } from "../infrastructure/WorkflowDefinitionRepository.js";

export class WorkflowDefinitionService extends BaseService {
  constructor(private readonly repository = new WorkflowDefinitionRepository()) {
    super();
  }

  list(context: WorkflowContext) {
    return this.repository.listByTenant(context.tenantId);
  }

  async getById(context: WorkflowContext, workflowDefinitionId: string) {
    const definition = await this.repository.findById(context.tenantId, workflowDefinitionId);
    return this.ensureFound(definition, "Workflow definition not found");
  }

  async create(context: WorkflowContext, input: WorkflowDefinitionCreateInput) {
    await this.ensureUniqueCode(context.tenantId, input.code);
    const definition = await this.repository.create(context.tenantId, input, context.userId);
    const found = this.ensureFound(definition, "Workflow definition could not be created");

    logger.info("Workflow definition created", {
      tenantId: context.tenantId,
      workflowDefinitionId: found.workflowDefinitionId
    });
    await this.audit(context, found.workflowDefinitionId);

    return found;
  }

  private async ensureUniqueCode(tenantId: string, code: string) {
    const exists = await this.repository.codeExists(tenantId, code);

    if (exists) {
      throw new ConflictError("Workflow definition code already exists", undefined, "WORKFLOW_CODE_EXISTS");
    }
  }

  private audit(context: WorkflowContext, workflowDefinitionId: string) {
    return auditEvent({
      tenantId: context.tenantId,
      companyId: context.companyId,
      userId: context.userId,
      action: "WORKFLOW_DEFINITION_CREATED",
      entity: "workflow.Definitions",
      entityId: workflowDefinitionId,
      metadata: {
        requestId: context.requestId,
        correlationId: context.correlationId
      }
    });
  }
}

export const workflowDefinitionService = new WorkflowDefinitionService();
