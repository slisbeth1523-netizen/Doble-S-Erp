import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type { WorkflowGuard, WorkflowGuardCreateInput } from "../domain/workflow.types.js";

const guardColumns = `
  WorkflowGuardId AS workflowGuardId,
  TenantId AS tenantId,
  WorkflowDefinitionId AS workflowDefinitionId,
  TransitionId AS transitionId,
  Code AS code,
  Name AS name,
  Description AS description,
  GuardType AS guardType,
  FieldName AS fieldName,
  ExpectedValue AS expectedValue,
  MetadataJson AS metadataJson,
  ErrorMessage AS errorMessage,
  IsActive AS isActive,
  CreatedAt AS createdAt,
  UpdatedAt AS updatedAt,
  CreatedBy AS createdBy,
  UpdatedBy AS updatedBy
`;

const guardOutputColumns = `
  inserted.WorkflowGuardId AS workflowGuardId,
  inserted.TenantId AS tenantId,
  inserted.WorkflowDefinitionId AS workflowDefinitionId,
  inserted.TransitionId AS transitionId,
  inserted.Code AS code,
  inserted.Name AS name,
  inserted.Description AS description,
  inserted.GuardType AS guardType,
  inserted.FieldName AS fieldName,
  inserted.ExpectedValue AS expectedValue,
  inserted.MetadataJson AS metadataJson,
  inserted.ErrorMessage AS errorMessage,
  inserted.IsActive AS isActive,
  inserted.CreatedAt AS createdAt,
  inserted.UpdatedAt AS updatedAt,
  inserted.CreatedBy AS createdBy,
  inserted.UpdatedBy AS updatedBy
`;

type ExistsRecord = { ExistsValue: number };

export class WorkflowGuardRepository extends BaseSqlRepository {
  listByTransition(tenantId: string, workflowDefinitionId: string, transitionId: string) {
    return this.query<WorkflowGuard>(
      `
        SELECT ${guardColumns}
        FROM workflow.Guards
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
    return this.query<WorkflowGuard>(
      `
        SELECT ${guardColumns}
        FROM workflow.Guards
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
        FROM workflow.Guards
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
    input: WorkflowGuardCreateInput,
    userId?: string
  ) {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: tenantId },
      { name: "WorkflowDefinitionId", value: workflowDefinitionId },
      { name: "TransitionId", value: transitionId },
      { name: "Code", value: input.code },
      { name: "Name", value: input.name },
      { name: "Description", value: input.description ?? null },
      { name: "GuardType", value: input.guardType },
      { name: "FieldName", value: input.fieldName ?? null },
      { name: "ExpectedValue", value: input.expectedValue ?? null },
      { name: "MetadataJson", value: input.metadata ? JSON.stringify(input.metadata) : null },
      { name: "ErrorMessage", value: input.errorMessage ?? null },
      { name: "IsActive", value: input.isActive ?? true },
      { name: "CreatedBy", value: userId ?? null }
    ];
    const result = await this.query<WorkflowGuard>(
      `
        INSERT INTO workflow.Guards (
          TenantId,
          WorkflowDefinitionId,
          TransitionId,
          Code,
          Name,
          Description,
          GuardType,
          FieldName,
          ExpectedValue,
          MetadataJson,
          ErrorMessage,
          IsActive,
          CreatedBy
        )
        OUTPUT ${guardOutputColumns}
        VALUES (
          @TenantId,
          @WorkflowDefinitionId,
          @TransitionId,
          @Code,
          @Name,
          @Description,
          @GuardType,
          @FieldName,
          @ExpectedValue,
          @MetadataJson,
          @ErrorMessage,
          @IsActive,
          @CreatedBy
        )
      `,
      parameters
    );

    return result[0];
  }
}
