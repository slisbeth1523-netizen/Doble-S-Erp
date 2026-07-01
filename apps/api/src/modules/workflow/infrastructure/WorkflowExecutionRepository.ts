import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type { WorkflowEntityState, WorkflowTransition } from "../domain/workflow.types.js";

const entityStateColumns = `
  EntityStateId AS entityStateId,
  TenantId AS tenantId,
  CompanyId AS companyId,
  WorkflowDefinitionId AS workflowDefinitionId,
  EntityName AS entityName,
  EntityId AS entityId,
  CurrentStateId AS currentStateId,
  IsActive AS isActive,
  CreatedAt AS createdAt,
  UpdatedAt AS updatedAt,
  CreatedBy AS createdBy,
  UpdatedBy AS updatedBy
`;

const entityStateOutputColumns = `
  inserted.EntityStateId AS entityStateId,
  inserted.TenantId AS tenantId,
  inserted.CompanyId AS companyId,
  inserted.WorkflowDefinitionId AS workflowDefinitionId,
  inserted.EntityName AS entityName,
  inserted.EntityId AS entityId,
  inserted.CurrentStateId AS currentStateId,
  inserted.IsActive AS isActive,
  inserted.CreatedAt AS createdAt,
  inserted.UpdatedAt AS updatedAt,
  inserted.CreatedBy AS createdBy,
  inserted.UpdatedBy AS updatedBy
`;

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

export class WorkflowExecutionRepository extends BaseSqlRepository {
  async getCurrentEntityState(
    tenantId: string,
    workflowDefinitionId: string,
    entityName: string,
    entityId: string
  ) {
    const result = await this.query<WorkflowEntityState>(
      `
        SELECT ${entityStateColumns}
        FROM workflow.EntityStates
        WHERE TenantId = @TenantId
          AND WorkflowDefinitionId = @WorkflowDefinitionId
          AND EntityName = @EntityName
          AND EntityId = @EntityId
          AND IsActive = 1
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "WorkflowDefinitionId", value: workflowDefinitionId },
        { name: "EntityName", value: entityName },
        { name: "EntityId", value: entityId }
      ]
    );

    return result[0];
  }

  async createInitialEntityState(input: {
    tenantId: string;
    companyId?: string | null;
    workflowDefinitionId: string;
    entityName: string;
    entityId: string;
    initialStateId: string;
    userId?: string;
  }) {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: input.tenantId },
      { name: "CompanyId", value: input.companyId ?? null },
      { name: "WorkflowDefinitionId", value: input.workflowDefinitionId },
      { name: "EntityName", value: input.entityName },
      { name: "EntityId", value: input.entityId },
      { name: "CurrentStateId", value: input.initialStateId },
      { name: "CreatedBy", value: input.userId ?? null }
    ];
    const result = await this.query<WorkflowEntityState>(
      `
        INSERT INTO workflow.EntityStates (
          TenantId,
          CompanyId,
          WorkflowDefinitionId,
          EntityName,
          EntityId,
          CurrentStateId,
          CreatedBy
        )
        OUTPUT ${entityStateOutputColumns}
        VALUES (
          @TenantId,
          @CompanyId,
          @WorkflowDefinitionId,
          @EntityName,
          @EntityId,
          @CurrentStateId,
          @CreatedBy
        )
      `,
      parameters
    );

    return result[0];
  }

  async updateCurrentEntityState(input: {
    tenantId: string;
    workflowDefinitionId: string;
    entityName: string;
    entityId: string;
    expectedCurrentStateId: string;
    newStateId: string;
    userId?: string;
  }) {
    const result = await this.query<WorkflowEntityState>(
      `
        UPDATE workflow.EntityStates
        SET CurrentStateId = @NewStateId,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UpdatedBy
        OUTPUT ${entityStateOutputColumns}
        WHERE TenantId = @TenantId
          AND WorkflowDefinitionId = @WorkflowDefinitionId
          AND EntityName = @EntityName
          AND EntityId = @EntityId
          AND CurrentStateId = @ExpectedCurrentStateId
          AND IsActive = 1
      `,
      [
        { name: "TenantId", value: input.tenantId },
        { name: "WorkflowDefinitionId", value: input.workflowDefinitionId },
        { name: "EntityName", value: input.entityName },
        { name: "EntityId", value: input.entityId },
        { name: "ExpectedCurrentStateId", value: input.expectedCurrentStateId },
        { name: "NewStateId", value: input.newStateId },
        { name: "UpdatedBy", value: input.userId ?? null }
      ]
    );

    return result[0];
  }

  async getValidTransition(
    tenantId: string,
    workflowDefinitionId: string,
    transitionId: string,
    currentStateId: string
  ) {
    const result = await this.query<WorkflowTransition>(
      `
        SELECT ${transitionColumns}
        FROM workflow.Transitions
        WHERE TenantId = @TenantId
          AND WorkflowDefinitionId = @WorkflowDefinitionId
          AND WorkflowTransitionId = @WorkflowTransitionId
          AND FromStateId = @CurrentStateId
          AND IsActive = 1
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "WorkflowDefinitionId", value: workflowDefinitionId },
        { name: "WorkflowTransitionId", value: transitionId },
        { name: "CurrentStateId", value: currentStateId }
      ]
    );

    return result[0];
  }

  async findTransitionById(tenantId: string, workflowDefinitionId: string, transitionId: string) {
    const result = await this.query<WorkflowTransition>(
      `
        SELECT ${transitionColumns}
        FROM workflow.Transitions
        WHERE TenantId = @TenantId
          AND WorkflowDefinitionId = @WorkflowDefinitionId
          AND WorkflowTransitionId = @WorkflowTransitionId
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "WorkflowDefinitionId", value: workflowDefinitionId },
        { name: "WorkflowTransitionId", value: transitionId }
      ]
    );

    return result[0];
  }
}
