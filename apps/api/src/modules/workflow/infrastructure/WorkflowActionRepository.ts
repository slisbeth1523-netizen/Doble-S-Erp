import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type { WorkflowAction, WorkflowActionCreateInput } from "../domain/workflow.types.js";

const actionColumns = `
  WorkflowActionId AS workflowActionId,
  TenantId AS tenantId,
  WorkflowDefinitionId AS workflowDefinitionId,
  TransitionId AS transitionId,
  Code AS code,
  Name AS name,
  Description AS description,
  ActionType AS actionType,
  ExecutionMode AS executionMode,
  TargetModule AS targetModule,
  TargetAction AS targetAction,
  PayloadTemplateJson AS payloadTemplateJson,
  IsActive AS isActive,
  CreatedAt AS createdAt,
  UpdatedAt AS updatedAt,
  CreatedBy AS createdBy,
  UpdatedBy AS updatedBy
`;

const actionOutputColumns = `
  inserted.WorkflowActionId AS workflowActionId,
  inserted.TenantId AS tenantId,
  inserted.WorkflowDefinitionId AS workflowDefinitionId,
  inserted.TransitionId AS transitionId,
  inserted.Code AS code,
  inserted.Name AS name,
  inserted.Description AS description,
  inserted.ActionType AS actionType,
  inserted.ExecutionMode AS executionMode,
  inserted.TargetModule AS targetModule,
  inserted.TargetAction AS targetAction,
  inserted.PayloadTemplateJson AS payloadTemplateJson,
  inserted.IsActive AS isActive,
  inserted.CreatedAt AS createdAt,
  inserted.UpdatedAt AS updatedAt,
  inserted.CreatedBy AS createdBy,
  inserted.UpdatedBy AS updatedBy
`;

type ExistsRecord = { ExistsValue: number };

export class WorkflowActionRepository extends BaseSqlRepository {
  listByTransition(tenantId: string, workflowDefinitionId: string, transitionId: string) {
    return this.query<WorkflowAction>(
      `
        SELECT ${actionColumns}
        FROM workflow.Actions
        WHERE TenantId = @TenantId
          AND WorkflowDefinitionId = @WorkflowDefinitionId
          AND TransitionId = @TransitionId
        ORDER BY CreatedAt ASC
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "WorkflowDefinitionId", value: workflowDefinitionId },
        { name: "TransitionId", value: transitionId }
      ]
    );
  }

  getActiveByTransition(tenantId: string, workflowDefinitionId: string, transitionId: string) {
    return this.query<WorkflowAction>(
      `
        SELECT ${actionColumns}
        FROM workflow.Actions
        WHERE TenantId = @TenantId
          AND WorkflowDefinitionId = @WorkflowDefinitionId
          AND TransitionId = @TransitionId
          AND IsActive = 1
        ORDER BY CreatedAt ASC
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "WorkflowDefinitionId", value: workflowDefinitionId },
        { name: "TransitionId", value: transitionId }
      ]
    );
  }

  async codeExists(tenantId: string, workflowDefinitionId: string, transitionId: string, code: string) {
    const result = await this.query<ExistsRecord>(
      `
        SELECT TOP 1 1 AS ExistsValue
        FROM workflow.Actions
        WHERE TenantId = @TenantId
          AND WorkflowDefinitionId = @WorkflowDefinitionId
          AND TransitionId = @TransitionId
          AND Code = @Code
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "WorkflowDefinitionId", value: workflowDefinitionId },
        { name: "TransitionId", value: transitionId },
        { name: "Code", value: code }
      ]
    );

    return result.length > 0;
  }

  async create(
    tenantId: string,
    workflowDefinitionId: string,
    transitionId: string,
    input: WorkflowActionCreateInput,
    userId?: string
  ) {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: tenantId },
      { name: "WorkflowDefinitionId", value: workflowDefinitionId },
      { name: "TransitionId", value: transitionId },
      { name: "Code", value: input.code },
      { name: "Name", value: input.name },
      { name: "Description", value: input.description ?? null },
      { name: "ActionType", value: input.actionType },
      { name: "ExecutionMode", value: input.executionMode },
      { name: "TargetModule", value: input.targetModule ?? null },
      { name: "TargetAction", value: input.targetAction ?? null },
      { name: "PayloadTemplateJson", value: input.payloadTemplate ? JSON.stringify(input.payloadTemplate) : null },
      { name: "IsActive", value: input.isActive ?? true },
      { name: "CreatedBy", value: userId ?? null }
    ];
    const result = await this.query<WorkflowAction>(
      `
        INSERT INTO workflow.Actions (
          TenantId,
          WorkflowDefinitionId,
          TransitionId,
          Code,
          Name,
          Description,
          ActionType,
          ExecutionMode,
          TargetModule,
          TargetAction,
          PayloadTemplateJson,
          IsActive,
          CreatedBy
        )
        OUTPUT ${actionOutputColumns}
        VALUES (
          @TenantId,
          @WorkflowDefinitionId,
          @TransitionId,
          @Code,
          @Name,
          @Description,
          @ActionType,
          @ExecutionMode,
          @TargetModule,
          @TargetAction,
          @PayloadTemplateJson,
          @IsActive,
          @CreatedBy
        )
      `,
      parameters
    );

    return result[0];
  }
}
