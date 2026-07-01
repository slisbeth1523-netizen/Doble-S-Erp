import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type { WorkflowDefinition, WorkflowDefinitionCreateInput } from "../domain/workflow.types.js";

const definitionColumns = `
  WorkflowDefinitionId AS workflowDefinitionId,
  TenantId AS tenantId,
  Code AS code,
  Name AS name,
  Description AS description,
  IsActive AS isActive,
  CreatedAt AS createdAt,
  UpdatedAt AS updatedAt,
  CreatedBy AS createdBy,
  UpdatedBy AS updatedBy
`;

const definitionOutputColumns = `
  inserted.WorkflowDefinitionId AS workflowDefinitionId,
  inserted.TenantId AS tenantId,
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

export class WorkflowDefinitionRepository extends BaseSqlRepository {
  listByTenant(tenantId: string) {
    return this.query<WorkflowDefinition>(
      `
        SELECT ${definitionColumns}
        FROM workflow.Definitions
        WHERE TenantId = @TenantId
        ORDER BY Name ASC
      `,
      [{ name: "TenantId", value: tenantId }]
    );
  }

  async findById(tenantId: string, workflowDefinitionId: string) {
    const result = await this.query<WorkflowDefinition>(
      `
        SELECT ${definitionColumns}
        FROM workflow.Definitions
        WHERE TenantId = @TenantId
          AND WorkflowDefinitionId = @WorkflowDefinitionId
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "WorkflowDefinitionId", value: workflowDefinitionId }
      ]
    );

    return result[0];
  }

  async codeExists(tenantId: string, code: string) {
    const result = await this.query<ExistsRecord>(
      `
        SELECT TOP 1 1 AS ExistsValue
        FROM workflow.Definitions
        WHERE TenantId = @TenantId
          AND Code = @Code
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "Code", value: code }
      ]
    );

    return result.length > 0;
  }

  async create(tenantId: string, input: WorkflowDefinitionCreateInput, userId?: string) {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: tenantId },
      { name: "Code", value: input.code },
      { name: "Name", value: input.name },
      { name: "Description", value: input.description ?? null },
      { name: "IsActive", value: input.isActive ?? true },
      { name: "CreatedBy", value: userId ?? null }
    ];
    const result = await this.query<WorkflowDefinition>(
      `
        INSERT INTO workflow.Definitions (
          TenantId,
          Code,
          Name,
          Description,
          IsActive,
          CreatedBy
        )
        OUTPUT ${definitionOutputColumns}
        VALUES (
          @TenantId,
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
