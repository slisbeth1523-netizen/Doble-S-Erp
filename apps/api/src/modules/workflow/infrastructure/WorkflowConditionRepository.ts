import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type { WorkflowCondition, WorkflowConditionCreateInput } from "../domain/workflow.types.js";

const conditionColumns = `
  WorkflowConditionId AS workflowConditionId,
  TenantId AS tenantId,
  WorkflowDefinitionId AS workflowDefinitionId,
  TransitionId AS transitionId,
  Code AS code,
  Name AS name,
  Description AS description,
  ConditionType AS conditionType,
  FieldName AS fieldName,
  Operator AS operator,
  ExpectedValue AS expectedValue,
  MetadataJson AS metadataJson,
  IsActive AS isActive,
  CreatedAt AS createdAt,
  UpdatedAt AS updatedAt,
  CreatedBy AS createdBy,
  UpdatedBy AS updatedBy
`;

const conditionOutputColumns = `
  inserted.WorkflowConditionId AS workflowConditionId,
  inserted.TenantId AS tenantId,
  inserted.WorkflowDefinitionId AS workflowDefinitionId,
  inserted.TransitionId AS transitionId,
  inserted.Code AS code,
  inserted.Name AS name,
  inserted.Description AS description,
  inserted.ConditionType AS conditionType,
  inserted.FieldName AS fieldName,
  inserted.Operator AS operator,
  inserted.ExpectedValue AS expectedValue,
  inserted.MetadataJson AS metadataJson,
  inserted.IsActive AS isActive,
  inserted.CreatedAt AS createdAt,
  inserted.UpdatedAt AS updatedAt,
  inserted.CreatedBy AS createdBy,
  inserted.UpdatedBy AS updatedBy
`;

type ExistsRecord = { ExistsValue: number };

export class WorkflowConditionRepository extends BaseSqlRepository {
  listByTransition(tenantId: string, workflowDefinitionId: string, transitionId: string) {
    return this.query<WorkflowCondition>(
      `
        SELECT ${conditionColumns}
        FROM workflow.Conditions
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
    return this.query<WorkflowCondition>(
      `
        SELECT ${conditionColumns}
        FROM workflow.Conditions
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
        FROM workflow.Conditions
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
    input: WorkflowConditionCreateInput,
    userId?: string
  ) {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: tenantId },
      { name: "WorkflowDefinitionId", value: workflowDefinitionId },
      { name: "TransitionId", value: transitionId },
      { name: "Code", value: input.code },
      { name: "Name", value: input.name },
      { name: "Description", value: input.description ?? null },
      { name: "ConditionType", value: input.conditionType },
      { name: "FieldName", value: input.fieldName ?? null },
      { name: "Operator", value: input.operator ?? null },
      { name: "ExpectedValue", value: input.expectedValue ?? null },
      { name: "MetadataJson", value: input.metadata ? JSON.stringify(input.metadata) : null },
      { name: "IsActive", value: input.isActive ?? true },
      { name: "CreatedBy", value: userId ?? null }
    ];
    const result = await this.query<WorkflowCondition>(
      `
        INSERT INTO workflow.Conditions (
          TenantId,
          WorkflowDefinitionId,
          TransitionId,
          Code,
          Name,
          Description,
          ConditionType,
          FieldName,
          Operator,
          ExpectedValue,
          MetadataJson,
          IsActive,
          CreatedBy
        )
        OUTPUT ${conditionOutputColumns}
        VALUES (
          @TenantId,
          @WorkflowDefinitionId,
          @TransitionId,
          @Code,
          @Name,
          @Description,
          @ConditionType,
          @FieldName,
          @Operator,
          @ExpectedValue,
          @MetadataJson,
          @IsActive,
          @CreatedBy
        )
      `,
      parameters
    );

    return result[0];
  }
}
