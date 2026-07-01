import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type { WorkflowState, WorkflowStateCreateInput } from "../domain/workflow.types.js";

const stateColumns = `
  WorkflowStateId AS workflowStateId,
  TenantId AS tenantId,
  WorkflowDefinitionId AS workflowDefinitionId,
  Code AS code,
  Name AS name,
  Description AS description,
  IsActive AS isActive,
  CreatedAt AS createdAt,
  UpdatedAt AS updatedAt,
  CreatedBy AS createdBy,
  UpdatedBy AS updatedBy
`;

const stateOutputColumns = `
  inserted.WorkflowStateId AS workflowStateId,
  inserted.TenantId AS tenantId,
  inserted.WorkflowDefinitionId AS workflowDefinitionId,
  inserted.Code AS code,
  inserted.Name AS name,
  inserted.Description AS description,
  inserted.IsActive AS isActive,
  inserted.CreatedAt AS createdAt,
  inserted.UpdatedAt AS updatedAt,
  inserted.CreatedBy AS createdBy,
  inserted.UpdatedBy AS updatedBy
`;

type ExistsRecord = { ExistsValue: number };

export class WorkflowStateRepository extends BaseSqlRepository {
  listByDefinition(tenantId: string, workflowDefinitionId: string) {
    return this.query<WorkflowState>(
      `
        SELECT ${stateColumns}
        FROM workflow.States
        WHERE TenantId = @TenantId
          AND WorkflowDefinitionId = @WorkflowDefinitionId
        ORDER BY Name ASC
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "WorkflowDefinitionId", value: workflowDefinitionId }
      ]
    );
  }

  async findById(tenantId: string, workflowDefinitionId: string, workflowStateId: string) {
    const result = await this.query<WorkflowState>(
      `
        SELECT ${stateColumns}
        FROM workflow.States
        WHERE TenantId = @TenantId
          AND WorkflowDefinitionId = @WorkflowDefinitionId
          AND WorkflowStateId = @WorkflowStateId
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "WorkflowDefinitionId", value: workflowDefinitionId },
        { name: "WorkflowStateId", value: workflowStateId }
      ]
    );

    return result[0];
  }

  async codeExists(tenantId: string, workflowDefinitionId: string, code: string) {
    const result = await this.query<ExistsRecord>(
      `
        SELECT TOP 1 1 AS ExistsValue
        FROM workflow.States
        WHERE TenantId = @TenantId
          AND WorkflowDefinitionId = @WorkflowDefinitionId
          AND Code = @Code
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "WorkflowDefinitionId", value: workflowDefinitionId },
        { name: "Code", value: code }
      ]
    );

    return result.length > 0;
  }

  async create(
    tenantId: string,
    workflowDefinitionId: string,
    input: WorkflowStateCreateInput,
    userId?: string
  ) {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: tenantId },
      { name: "WorkflowDefinitionId", value: workflowDefinitionId },
      { name: "Code", value: input.code },
      { name: "Name", value: input.name },
      { name: "Description", value: input.description ?? null },
      { name: "IsActive", value: input.isActive ?? true },
      { name: "CreatedBy", value: userId ?? null }
    ];
    const result = await this.query<WorkflowState>(
      `
        INSERT INTO workflow.States (
          TenantId,
          WorkflowDefinitionId,
          Code,
          Name,
          Description,
          IsActive,
          CreatedBy
        )
        OUTPUT ${stateOutputColumns}
        VALUES (
          @TenantId,
          @WorkflowDefinitionId,
          @Code,
          @Name,
          @Description,
          @IsActive,
          @CreatedBy
        )
      `,
      parameters
    );

    return result[0];
  }
}
