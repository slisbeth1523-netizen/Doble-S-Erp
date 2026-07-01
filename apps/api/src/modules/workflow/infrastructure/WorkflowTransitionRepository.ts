import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  WorkflowTransition,
  WorkflowTransitionCreateInput
} from "../domain/workflow.types.js";

const transitionColumns = `
  WorkflowTransitionId AS workflowTransitionId,
  TenantId AS tenantId,
  WorkflowDefinitionId AS workflowDefinitionId,
  FromStateId AS fromStateId,
  ToStateId AS toStateId,
  Code AS code,
  Name AS name,
  Description AS description,
  IsActive AS isActive,
  CreatedAt AS createdAt,
  UpdatedAt AS updatedAt,
  CreatedBy AS createdBy,
  UpdatedBy AS updatedBy
`;

const transitionOutputColumns = `
  inserted.WorkflowTransitionId AS workflowTransitionId,
  inserted.TenantId AS tenantId,
  inserted.WorkflowDefinitionId AS workflowDefinitionId,
  inserted.FromStateId AS fromStateId,
  inserted.ToStateId AS toStateId,
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

export class WorkflowTransitionRepository extends BaseSqlRepository {
  listByDefinition(tenantId: string, workflowDefinitionId: string) {
    return this.query<WorkflowTransition>(
      `
        SELECT ${transitionColumns}
        FROM workflow.Transitions
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

  async codeExists(tenantId: string, workflowDefinitionId: string, code: string) {
    const result = await this.query<ExistsRecord>(
      `
        SELECT TOP 1 1 AS ExistsValue
        FROM workflow.Transitions
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
    input: WorkflowTransitionCreateInput,
    userId?: string
  ) {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: tenantId },
      { name: "WorkflowDefinitionId", value: workflowDefinitionId },
      { name: "FromStateId", value: input.fromStateId },
      { name: "ToStateId", value: input.toStateId },
      { name: "Code", value: input.code },
      { name: "Name", value: input.name },
      { name: "Description", value: input.description ?? null },
      { name: "IsActive", value: input.isActive ?? true },
      { name: "CreatedBy", value: userId ?? null }
    ];
    const result = await this.query<WorkflowTransition>(
      `
        INSERT INTO workflow.Transitions (
          TenantId,
          WorkflowDefinitionId,
          FromStateId,
          ToStateId,
          Code,
          Name,
          Description,
          IsActive,
          CreatedBy
        )
        OUTPUT ${transitionOutputColumns}
        VALUES (
          @TenantId,
          @WorkflowDefinitionId,
          @FromStateId,
          @ToStateId,
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
