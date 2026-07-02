import { BaseSqlRepository } from "../../../repositories/BaseSqlRepository.js";
import type {
  WorkflowActionExecution,
  WorkflowActionExecutionCreateInput,
  WorkflowActionExecutionListResult,
  WorkflowActionExecutionQuery
} from "../domain/workflow.types.js";

const executionColumns = `
  WorkflowActionExecutionId AS workflowActionExecutionId,
  TenantId AS tenantId,
  CompanyId AS companyId,
  WorkflowActionId AS workflowActionId,
  WorkflowDefinitionId AS workflowDefinitionId,
  TransitionId AS transitionId,
  EntityStateId AS entityStateId,
  EntityName AS entityName,
  EntityId AS entityId,
  Status AS status,
  ActionType AS actionType,
  ExecutionMode AS executionMode,
  PayloadJson AS payloadJson,
  ResultJson AS resultJson,
  ErrorMessage AS errorMessage,
  CreatedAt AS createdAt,
  UpdatedAt AS updatedAt,
  CreatedBy AS createdBy,
  RequestId AS requestId,
  CorrelationId AS correlationId
`;

const executionOutputColumns = `
  inserted.WorkflowActionExecutionId AS workflowActionExecutionId,
  inserted.TenantId AS tenantId,
  inserted.CompanyId AS companyId,
  inserted.WorkflowActionId AS workflowActionId,
  inserted.WorkflowDefinitionId AS workflowDefinitionId,
  inserted.TransitionId AS transitionId,
  inserted.EntityStateId AS entityStateId,
  inserted.EntityName AS entityName,
  inserted.EntityId AS entityId,
  inserted.Status AS status,
  inserted.ActionType AS actionType,
  inserted.ExecutionMode AS executionMode,
  inserted.PayloadJson AS payloadJson,
  inserted.ResultJson AS resultJson,
  inserted.ErrorMessage AS errorMessage,
  inserted.CreatedAt AS createdAt,
  inserted.UpdatedAt AS updatedAt,
  inserted.CreatedBy AS createdBy,
  inserted.RequestId AS requestId,
  inserted.CorrelationId AS correlationId
`;

type CountRecord = { TotalItems: number };

export class WorkflowActionExecutionRepository extends BaseSqlRepository {
  async createExecution(input: WorkflowActionExecutionCreateInput) {
    const result = await this.query<WorkflowActionExecution>(
      `
        INSERT INTO workflow.ActionExecutions (
          TenantId,
          CompanyId,
          WorkflowActionId,
          WorkflowDefinitionId,
          TransitionId,
          EntityStateId,
          EntityName,
          EntityId,
          Status,
          ActionType,
          ExecutionMode,
          PayloadJson,
          ResultJson,
          ErrorMessage,
          CreatedBy,
          RequestId,
          CorrelationId
        )
        OUTPUT ${executionOutputColumns}
        VALUES (
          @TenantId,
          @CompanyId,
          @WorkflowActionId,
          @WorkflowDefinitionId,
          @TransitionId,
          @EntityStateId,
          @EntityName,
          @EntityId,
          @Status,
          @ActionType,
          @ExecutionMode,
          @PayloadJson,
          @ResultJson,
          @ErrorMessage,
          @CreatedBy,
          @RequestId,
          @CorrelationId
        )
      `,
      [
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId ?? null },
        { name: "WorkflowActionId", value: input.workflowActionId },
        { name: "WorkflowDefinitionId", value: input.workflowDefinitionId },
        { name: "TransitionId", value: input.transitionId },
        { name: "EntityStateId", value: input.entityStateId },
        { name: "EntityName", value: input.entityName },
        { name: "EntityId", value: input.entityId },
        { name: "Status", value: input.status },
        { name: "ActionType", value: input.actionType },
        { name: "ExecutionMode", value: input.executionMode },
        { name: "PayloadJson", value: input.payload ? JSON.stringify(input.payload) : null },
        { name: "ResultJson", value: input.result ? JSON.stringify(input.result) : null },
        { name: "ErrorMessage", value: input.errorMessage ?? null },
        { name: "CreatedBy", value: input.createdBy ?? null },
        { name: "RequestId", value: input.requestId ?? null },
        { name: "CorrelationId", value: input.correlationId ?? null }
      ]
    );

    return result[0];
  }

  listByEntity(query: WorkflowActionExecutionQuery) {
    return this.list(query);
  }

  listByStatus(query: WorkflowActionExecutionQuery) {
    return this.list(query);
  }

  listByAction(query: WorkflowActionExecutionQuery) {
    return this.list(query);
  }

  private async list(query: WorkflowActionExecutionQuery): Promise<WorkflowActionExecutionListResult> {
    const where = ["TenantId = @TenantId"];
    const parameters = [
      { name: "TenantId", value: query.tenantId },
      { name: "Offset", value: query.offset },
      { name: "Limit", value: query.pageSize }
    ];

    if (query.workflowActionId) {
      where.push("WorkflowActionId = @WorkflowActionId");
      parameters.push({ name: "WorkflowActionId", value: query.workflowActionId });
    }

    if (query.status) {
      where.push("Status = @Status");
      parameters.push({ name: "Status", value: query.status });
    }

    if (query.entityName) {
      where.push("EntityName = @EntityName");
      parameters.push({ name: "EntityName", value: query.entityName });
    }

    if (query.entityId) {
      where.push("EntityId = @EntityId");
      parameters.push({ name: "EntityId", value: query.entityId });
    }

    const whereSql = where.join(" AND ");
    const items = await this.query<WorkflowActionExecution>(
      `
        SELECT ${executionColumns}
        FROM workflow.ActionExecutions
        WHERE ${whereSql}
        ORDER BY CreatedAt DESC
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
      `,
      parameters
    );
    const count = await this.query<CountRecord>(
      `
        SELECT COUNT(1) AS TotalItems
        FROM workflow.ActionExecutions
        WHERE ${whereSql}
      `,
      parameters.filter((parameter) => parameter.name !== "Offset" && parameter.name !== "Limit")
    );

    return {
      items,
      totalItems: count[0]?.TotalItems ?? 0
    };
  }
}
