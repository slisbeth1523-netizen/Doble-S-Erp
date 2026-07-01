import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import type {
  WorkflowActionExecutionCreateInput,
  WorkflowActionExecutionQuery
} from "../domain/workflow.types.js";
import { WorkflowActionExecutionRepository } from "../infrastructure/WorkflowActionExecutionRepository.js";

export class WorkflowActionExecutionService extends BaseService {
  constructor(private readonly repository = new WorkflowActionExecutionRepository()) {
    super();
  }

  async createPreparedExecution(input: WorkflowActionExecutionCreateInput) {
    const execution = await this.repository.createExecution(input);
    const found = this.ensureFound(execution, "Workflow action execution could not be prepared");
    await auditEvent({
      tenantId: input.tenantId,
      companyId: input.companyId ?? undefined,
      userId: input.createdBy,
      action: "WORKFLOW_ACTION_EXECUTION_PREPARED",
      entity: "workflow.ActionExecutions",
      entityId: found.workflowActionExecutionId,
      metadata: {
        workflowActionId: input.workflowActionId,
        workflowDefinitionId: input.workflowDefinitionId,
        transitionId: input.transitionId,
        status: input.status,
        requestId: input.requestId,
        correlationId: input.correlationId
      }
    });

    return found;
  }

  listByEntity(query: WorkflowActionExecutionQuery) {
    return this.repository.listByEntity(query);
  }

  listByStatus(query: WorkflowActionExecutionQuery) {
    return this.repository.listByStatus(query);
  }

  listByAction(query: WorkflowActionExecutionQuery) {
    return this.repository.listByAction(query);
  }
}

export const workflowActionExecutionService = new WorkflowActionExecutionService();
