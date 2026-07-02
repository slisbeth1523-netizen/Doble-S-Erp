import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  WorkflowHistoryCreateInput,
  WorkflowHistoryEntry,
  WorkflowHistoryListResult,
  WorkflowHistoryQuery
} from "../domain/workflow.types.js";

const historyColumns = `
  WorkflowHistoryId AS workflowHistoryId,
  TenantId AS tenantId,
  CompanyId AS companyId,
  WorkflowDefinitionId AS workflowDefinitionId,
  EntityStateId AS entityStateId,
  EntityName AS entityName,
  EntityId AS entityId,
  TransitionId AS transitionId,
  FromStateId AS fromStateId,
  ToStateId AS toStateId,
  ActionCode AS actionCode,
  Comment AS comment,
  MetadataJson AS metadataJson,
  CreatedAt AS createdAt,
  CreatedBy AS createdBy,
  RequestId AS requestId,
  CorrelationId AS correlationId
`;

const historyOutputColumns = `
  inserted.WorkflowHistoryId AS workflowHistoryId,
  inserted.TenantId AS tenantId,
  inserted.CompanyId AS companyId,
  inserted.WorkflowDefinitionId AS workflowDefinitionId,
  inserted.EntityStateId AS entityStateId,
  inserted.EntityName AS entityName,
  inserted.EntityId AS entityId,
  inserted.TransitionId AS transitionId,
  inserted.FromStateId AS fromStateId,
  inserted.ToStateId AS toStateId,
  inserted.ActionCode AS actionCode,
  inserted.Comment AS comment,
  inserted.MetadataJson AS metadataJson,
  inserted.CreatedAt AS createdAt,
  inserted.CreatedBy AS createdBy,
  inserted.RequestId AS requestId,
  inserted.CorrelationId AS correlationId
`;

type CountRecord = { TotalItems: number };

function buildHistoryWhere(query: WorkflowHistoryQuery) {
  const where = ["TenantId = @TenantId"];
  const parameters: SqlParameter[] = [
    { name: "TenantId", value: query.tenantId },
    { name: "Offset", value: query.offset },
    { name: "Limit", value: query.pageSize }
  ];

  if (query.workflowDefinitionId) {
    where.push("WorkflowDefinitionId = @WorkflowDefinitionId");
    parameters.push({ name: "WorkflowDefinitionId", value: query.workflowDefinitionId });
  }

  if (query.entityStateId) {
    where.push("EntityStateId = @EntityStateId");
    parameters.push({ name: "EntityStateId", value: query.entityStateId });
  }

  if (query.entityName) {
    where.push("EntityName = @EntityName");
    parameters.push({ name: "EntityName", value: query.entityName });
  }

  if (query.entityId) {
    where.push("EntityId = @EntityId");
    parameters.push({ name: "EntityId", value: query.entityId });
  }

  if (query.from) {
    where.push("CreatedAt >= @From");
    parameters.push({ name: "From", value: query.from });
  }

  if (query.to) {
    where.push("CreatedAt <= @To");
    parameters.push({ name: "To", value: query.to });
  }

  return { where, parameters };
}

export class WorkflowHistoryRepository extends BaseSqlRepository {
  async createHistoryEntry(input: WorkflowHistoryCreateInput) {
    const result = await this.query<WorkflowHistoryEntry>(
      `
        INSERT INTO workflow.History (
          TenantId,
          CompanyId,
          WorkflowDefinitionId,
          EntityStateId,
          EntityName,
          EntityId,
          TransitionId,
          FromStateId,
          ToStateId,
          ActionCode,
          Comment,
          MetadataJson,
          CreatedBy,
          RequestId,
          CorrelationId
        )
        OUTPUT ${historyOutputColumns}
        VALUES (
          @TenantId,
          @CompanyId,
          @WorkflowDefinitionId,
          @EntityStateId,
          @EntityName,
          @EntityId,
          @TransitionId,
          @FromStateId,
          @ToStateId,
          @ActionCode,
          @Comment,
          @MetadataJson,
          @CreatedBy,
          @RequestId,
          @CorrelationId
        )
      `,
      [
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId ?? null },
        { name: "WorkflowDefinitionId", value: input.workflowDefinitionId },
        { name: "EntityStateId", value: input.entityStateId },
        { name: "EntityName", value: input.entityName },
        { name: "EntityId", value: input.entityId },
        { name: "TransitionId", value: input.transitionId ?? null },
        { name: "FromStateId", value: input.fromStateId ?? null },
        { name: "ToStateId", value: input.toStateId },
        { name: "ActionCode", value: input.actionCode },
        { name: "Comment", value: input.comment ?? null },
        { name: "MetadataJson", value: input.metadata ? JSON.stringify(input.metadata) : null },
        { name: "CreatedBy", value: input.createdBy ?? null },
        { name: "RequestId", value: input.requestId ?? null },
        { name: "CorrelationId", value: input.correlationId ?? null }
      ]
    );

    return result[0];
  }

  listByEntity(query: WorkflowHistoryQuery) {
    return this.list({
      ...query,
      entityStateId: undefined
    });
  }

  listByWorkflow(query: WorkflowHistoryQuery) {
    return this.list({
      ...query,
      entityName: undefined,
      entityId: undefined,
      entityStateId: undefined
    });
  }

  listByEntityState(query: WorkflowHistoryQuery) {
    return this.list({
      ...query,
      entityName: undefined,
      entityId: undefined
    });
  }

  private async list(query: WorkflowHistoryQuery): Promise<WorkflowHistoryListResult> {
    const { where, parameters } = buildHistoryWhere(query);
    const whereSql = where.join(" AND ");
    const items = await this.query<WorkflowHistoryEntry>(
      `
        SELECT ${historyColumns}
        FROM workflow.History
        WHERE ${whereSql}
        ORDER BY CreatedAt DESC
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
      `,
      parameters
    );
    const count = await this.query<CountRecord>(
      `
        SELECT COUNT(1) AS TotalItems
        FROM workflow.History
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
