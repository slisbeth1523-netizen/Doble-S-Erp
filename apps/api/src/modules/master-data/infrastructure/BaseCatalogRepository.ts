import type { BaseFilters, Pagination, Sorting } from "@doble-s-erp/shared";
import sql from "mssql";

import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import { ConflictError, ValidationError } from "../../../errors/index.js";
import type { CatalogDefinition } from "../domain/catalog-definition.js";

export type CatalogListInput = {
  tenantId: string;
  companyId?: string;
  filters: BaseFilters;
  pagination: Pagination;
  sorting: Sorting<string>;
};

export type CatalogWriteInput = {
  tenantId: string;
  companyId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  userId?: string;
} & Record<string, unknown>;

type CatalogRecord = Record<string, unknown>;
type CountRecord = { TotalItems: number };
type ExistsRecord = { ExistsValue: number };
const commonFieldAliases = new Set(["id", "tenantId", "companyId", "code", "name", "description", "isActive", "createdAt", "updatedAt", "createdBy", "updatedBy"]);
const commonWritableFields = new Set(["code", "name", "description", "companyId", "isActive"]);

function extraFields(definition: CatalogDefinition) {
  return definition.fields.filter((field) => field.dbColumn && !commonWritableFields.has(field.field));
}

function buildSelectColumns(definition: CatalogDefinition) {
  const columns = definition.columns;
  const selected = [
    `${columns.id} AS id`,
    `${columns.tenantId} AS tenantId`,
    columns.companyId ? `${columns.companyId} AS companyId` : "CAST(NULL AS UNIQUEIDENTIFIER) AS companyId",
    `${columns.code} AS code`,
    `${columns.name} AS name`,
    columns.description ? `${columns.description} AS description` : "CAST(NULL AS NVARCHAR(250)) AS description",
    `${columns.isActive} AS isActive`,
    `${columns.createdAt} AS createdAt`,
    `${columns.updatedAt} AS updatedAt`,
    `${columns.createdBy} AS createdBy`,
    `${columns.updatedBy} AS updatedBy`
  ];

  for (const field of extraFields(definition)) {
    if (!commonFieldAliases.has(field.field)) {
      selected.push(`${field.dbColumn} AS ${field.field}`);
    }
  }

  return selected.join(",\n          ");
}

function buildOutputColumns(definition: CatalogDefinition) {
  const columns = definition.columns;
  const selected = [
    `inserted.${columns.id} AS id`,
    `inserted.${columns.tenantId} AS tenantId`,
    columns.companyId
      ? `inserted.${columns.companyId} AS companyId`
      : "CAST(NULL AS UNIQUEIDENTIFIER) AS companyId",
    `inserted.${columns.code} AS code`,
    `inserted.${columns.name} AS name`,
    columns.description ? `inserted.${columns.description} AS description` : "CAST(NULL AS NVARCHAR(250)) AS description",
    `inserted.${columns.isActive} AS isActive`,
    `inserted.${columns.createdAt} AS createdAt`,
    `inserted.${columns.updatedAt} AS updatedAt`,
    `inserted.${columns.createdBy} AS createdBy`,
    `inserted.${columns.updatedBy} AS updatedBy`
  ];

  for (const field of extraFields(definition)) {
    if (!commonFieldAliases.has(field.field)) {
      selected.push(`inserted.${field.dbColumn} AS ${field.field}`);
    }
  }

  return selected.join(",\n          ");
}

function buildScopeWhere(definition: CatalogDefinition, includeCompany: boolean) {
  const where = [`${definition.columns.tenantId} = @TenantId`];

  if (definition.companyScoped && includeCompany && definition.columns.companyId) {
    where.push(`${definition.columns.companyId} = @CompanyId`);
  }

  return where;
}

export class BaseCatalogRepository extends BaseSqlRepository {
  async list(definition: CatalogDefinition, input: CatalogListInput) {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: input.tenantId },
      { name: "Offset", value: input.pagination.offset },
      { name: "Limit", value: input.pagination.limit }
    ];
    const where = buildScopeWhere(definition, Boolean(input.companyId));

    if (definition.companyScoped && input.companyId) {
      parameters.push({ name: "CompanyId", value: input.companyId });
    }

    if (input.filters.search) {
      const searchWhere = definition.allowedSearchColumns
        .map((column) => `${column} LIKE @Search`)
        .join(" OR ");
      where.push(`(${searchWhere})`);
      parameters.push({ name: "Search", value: `%${input.filters.search}%` });
    }

    if (typeof input.filters.isActive === "boolean") {
      where.push(`${definition.columns.isActive} = @IsActive`);
      parameters.push({ name: "IsActive", value: input.filters.isActive });
    }

    if (input.filters.createdFrom) {
      where.push(`${definition.columns.createdAt} >= @CreatedFrom`);
      parameters.push({ name: "CreatedFrom", value: input.filters.createdFrom });
    }

    if (input.filters.createdTo) {
      where.push(`${definition.columns.createdAt} <= @CreatedTo`);
      parameters.push({ name: "CreatedTo", value: input.filters.createdTo });
    }

    const sortBy = definition.allowedSortColumns.includes(input.sorting.sortBy)
      ? input.sorting.sortBy
      : definition.defaultSortBy;
    const orderBy = `${sortBy} ${input.sorting.sortDirection.toUpperCase()}`;
    const whereSql = where.join(" AND ");

    const items = await this.query<CatalogRecord>(
      `
        SELECT
          ${buildSelectColumns(definition)}
        FROM ${definition.tableName}
        WHERE ${whereSql}
        ORDER BY ${orderBy}
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
      `,
      parameters
    );

    const count = await this.query<CountRecord>(
      `
        SELECT COUNT(1) AS TotalItems
        FROM ${definition.tableName}
        WHERE ${whereSql}
      `,
      parameters.filter((parameter) => parameter.name !== "Offset" && parameter.name !== "Limit")
    );

    return {
      items,
      totalItems: count[0]?.TotalItems ?? 0
    };
  }

  async findById(definition: CatalogDefinition, tenantId: string, id: string, companyId?: string) {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: tenantId },
      { name: "Id", value: id }
    ];
    const where = buildScopeWhere(definition, Boolean(companyId));
    where.push(`${definition.idColumn} = @Id`);

    if (definition.companyScoped && companyId) {
      parameters.push({ name: "CompanyId", value: companyId });
    }

    const result = await this.query<CatalogRecord>(
      `
        SELECT
          ${buildSelectColumns(definition)}
        FROM ${definition.tableName}
        WHERE ${where.join(" AND ")}
      `,
      parameters
    );

    return result[0];
  }

  async findByCode(definition: CatalogDefinition, tenantId: string, code: string, companyId?: string) {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: tenantId },
      { name: "Code", value: code }
    ];
    const where = buildScopeWhere(definition, Boolean(companyId));
    where.push(`${definition.codeColumn} = @Code`);

    if (definition.companyScoped && companyId) {
      parameters.push({ name: "CompanyId", value: companyId });
    }

    const result = await this.query<CatalogRecord>(
      `
        SELECT
          ${buildSelectColumns(definition)}
        FROM ${definition.tableName}
        WHERE ${where.join(" AND ")}
      `,
      parameters
    );

    return result[0];
  }

  async codeExists(
    definition: CatalogDefinition,
    tenantId: string,
    code: string,
    companyId?: string | null,
    excludeId?: string
  ) {
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: tenantId },
      { name: "Code", value: code }
    ];
    const where = buildScopeWhere(definition, Boolean(companyId));
    where.push(`${definition.codeColumn} = @Code`);

    if (definition.companyScoped && companyId) {
      parameters.push({ name: "CompanyId", value: companyId });
    }

    if (excludeId) {
      where.push(`${definition.idColumn} <> @ExcludeId`);
      parameters.push({ name: "ExcludeId", value: excludeId });
    }

    const result = await this.query<ExistsRecord>(
      `
        SELECT TOP 1 1 AS ExistsValue
        FROM ${definition.tableName}
        WHERE ${where.join(" AND ")}
      `,
      parameters
    );

    return result.length > 0;
  }

  async create(definition: CatalogDefinition, input: CatalogWriteInput) {
    const extra = extraFields(definition);
    const insertColumns = [
      definition.columns.tenantId,
      definition.columns.companyId ?? "CompanyId",
      definition.codeColumn,
      definition.nameColumn,
      ...(definition.descriptionColumn ? [definition.descriptionColumn] : []),
      ...extra.map((field) => field.dbColumn!),
      definition.columns.isActive,
      definition.columns.createdBy
    ];
    const insertValues = [
      "@TenantId",
      "@CompanyId",
      "@Code",
      "@Name",
      ...(definition.descriptionColumn ? ["@Description"] : []),
      ...extra.map((field) => `@${field.dbColumn}`),
      "@IsActive",
      "@CreatedBy"
    ];
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: input.tenantId },
      { name: "CompanyId", value: input.companyId ?? null },
      { name: "Code", value: input.code },
      { name: "Name", value: input.name },
      { name: "Description", value: input.description ?? null },
      { name: "IsActive", value: input.isActive ?? true },
      { name: "CreatedBy", value: input.userId ?? null },
      ...extra.map((field) => ({ name: field.dbColumn!, value: input[field.field] ?? null }))
    ];
    const result = await this.query<CatalogRecord>(
      `
        INSERT INTO ${definition.tableName} (
          ${insertColumns.join(",\n          ")}
        )
        OUTPUT
          ${buildOutputColumns(definition)}
        VALUES (
          ${insertValues.join(",\n          ")}
        )
      `,
      parameters
    );

    return result[0];
  }

  async update(definition: CatalogDefinition, id: string, input: CatalogWriteInput) {
    const extra = extraFields(definition);
    const setColumns = [
      `${definition.columns.companyId ?? "CompanyId"} = @CompanyId`,
      `${definition.codeColumn} = @Code`,
      `${definition.nameColumn} = @Name`,
      ...(definition.descriptionColumn ? [`${definition.descriptionColumn} = @Description`] : []),
      ...extra.map((field) => `${field.dbColumn} = @${field.dbColumn}`),
      `${definition.columns.isActive} = @IsActive`,
      `${definition.columns.updatedAt} = SYSUTCDATETIME()`,
      `${definition.columns.updatedBy} = @UpdatedBy`
    ];
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: input.tenantId },
      { name: "Id", value: id },
      { name: "CompanyId", value: input.companyId ?? null },
      { name: "Code", value: input.code },
      { name: "Name", value: input.name },
      { name: "Description", value: input.description ?? null },
      { name: "IsActive", value: input.isActive ?? true },
      { name: "UpdatedBy", value: input.userId ?? null },
      ...extra.map((field) => ({ name: field.dbColumn!, value: input[field.field] ?? null }))
    ];
    const result = await this.query<CatalogRecord>(
      `
        UPDATE ${definition.tableName}
        SET
          ${setColumns.join(",\n          ")}
        OUTPUT
          ${buildOutputColumns(definition)}
        WHERE ${definition.columns.tenantId} = @TenantId
          AND ${definition.idColumn} = @Id
      `,
      parameters
    );

    return result[0];
  }

  async updateCostCenterHierarchy(definition: CatalogDefinition, id: string, input: CatalogWriteInput) {
    const parentId = typeof input.parentId === "string" && input.parentId.trim() ? input.parentId : null;
    const companyId = typeof input.companyId === "string" ? input.companyId : null;

    return this.executeInTransaction(async (transaction) => {
      const current = await this.queryInTransaction<CatalogRecord>(
        transaction,
        `
          SELECT
            ${buildSelectColumns(definition)}
          FROM ${definition.tableName} WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
          WHERE ${definition.columns.tenantId} = @TenantId
            AND ${definition.columns.companyId} = @CompanyId
            AND ${definition.idColumn} = @Id
        `,
        [
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: companyId },
          { name: "Id", value: id }
        ]
      );

      if (!current[0]) {
        return undefined;
      }

      let parentLevel = 0;
      if (parentId) {
        const parent = await this.queryInTransaction<CatalogRecord>(
          transaction,
          `
            SELECT
              ${buildSelectColumns(definition)}
            FROM ${definition.tableName} WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
            WHERE ${definition.columns.tenantId} = @TenantId
              AND ${definition.columns.companyId} = @CompanyId
              AND ${definition.idColumn} = @ParentId
          `,
          [
            { name: "TenantId", value: input.tenantId },
            { name: "CompanyId", value: companyId },
            { name: "ParentId", value: parentId }
          ]
        );

        if (!parent[0]) {
          throw new ValidationError(
            "Parent cost center was not found in the active company",
            [{ field: "parentId", message: "Parent cost center must belong to the same company" }],
            "COST_CENTER_PARENT_NOT_FOUND"
          );
        }

        parentLevel = Number(parent[0].level ?? 0);
      }

      const descendants = await this.queryInTransaction<{ CostCenterId: string }>(
        transaction,
        `
          WITH Descendants AS (
            SELECT CostCenterId
            FROM accounting.CostCenters WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
            WHERE TenantId = @TenantId
              AND CompanyId = @CompanyId
              AND CostCenterId = @Id

            UNION ALL

            SELECT child.CostCenterId
            FROM accounting.CostCenters child WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
            INNER JOIN Descendants parent ON child.ParentCostCenterId = parent.CostCenterId
            WHERE child.TenantId = @TenantId
              AND child.CompanyId = @CompanyId
          )
          SELECT CostCenterId
          FROM Descendants
          OPTION (MAXRECURSION 32767);
        `,
        [
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: companyId },
          { name: "Id", value: id }
        ]
      );

      if (parentId && descendants.some((row) => row.CostCenterId.toLowerCase() === parentId.toLowerCase())) {
        throw new ConflictError(
          "Cost center hierarchy cannot contain cycles",
          { costCenterId: id, parentId },
          "COST_CENTER_HIERARCHY_CYCLE"
        );
      }

      const newLevel = parentLevel + 1;
      await this.queryInTransaction(
        transaction,
        `
          UPDATE ${definition.tableName}
          SET
            ${definition.columns.companyId ?? "CompanyId"} = @CompanyId,
            ${definition.codeColumn} = @Code,
            ${definition.nameColumn} = @Name,
            ${definition.descriptionColumn ? `${definition.descriptionColumn} = @Description,` : ""}
            ParentCostCenterId = @ParentCostCenterId,
            Level = @Level,
            AllowsPosting = @AllowsPosting,
            ValidFrom = @ValidFrom,
            ValidTo = @ValidTo,
            ${definition.columns.isActive} = @IsActive,
            ${definition.columns.updatedAt} = SYSUTCDATETIME(),
            ${definition.columns.updatedBy} = @UpdatedBy
          WHERE ${definition.columns.tenantId} = @TenantId
            AND ${definition.columns.companyId} = @CompanyId
            AND ${definition.idColumn} = @Id;

          WITH Subtree AS (
            SELECT
              CostCenterId,
              CAST(@Level AS INT) AS NewLevel
            FROM accounting.CostCenters WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
            WHERE TenantId = @TenantId
              AND CompanyId = @CompanyId
              AND CostCenterId = @Id

            UNION ALL

            SELECT
              child.CostCenterId,
              parent.NewLevel + 1 AS NewLevel
            FROM accounting.CostCenters child WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
            INNER JOIN Subtree parent ON child.ParentCostCenterId = parent.CostCenterId
            WHERE child.TenantId = @TenantId
              AND child.CompanyId = @CompanyId
          )
          UPDATE target
          SET
            target.Level = Subtree.NewLevel,
            target.UpdatedAt = SYSUTCDATETIME(),
            target.UpdatedBy = @UpdatedBy
          FROM accounting.CostCenters target
          INNER JOIN Subtree ON target.CostCenterId = Subtree.CostCenterId
          OPTION (MAXRECURSION 32767);
        `,
        [
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: companyId },
          { name: "Id", value: id },
          { name: "Code", value: input.code },
          { name: "Name", value: input.name },
          { name: "Description", value: input.description ?? null },
          { name: "ParentCostCenterId", value: parentId },
          { name: "Level", value: newLevel },
          { name: "AllowsPosting", value: input.allowsPosting ?? true },
          { name: "ValidFrom", value: input.validFrom ?? null },
          { name: "ValidTo", value: input.validTo ?? null },
          { name: "IsActive", value: input.isActive ?? true },
          { name: "UpdatedBy", value: input.userId ?? null }
        ]
      );

      const updated = await this.queryInTransaction<CatalogRecord>(
        transaction,
        `
          SELECT
            ${buildSelectColumns(definition)}
          FROM ${definition.tableName}
          WHERE ${definition.columns.tenantId} = @TenantId
            AND ${definition.columns.companyId} = @CompanyId
            AND ${definition.idColumn} = @Id
        `,
        [
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: companyId },
          { name: "Id", value: id }
        ]
      );

      return updated[0];
    });
  }

  async setActive(
    definition: CatalogDefinition,
    tenantId: string,
    id: string,
    isActive: boolean,
    userId?: string
  ) {
    const result = await this.query<CatalogRecord>(
      `
        UPDATE ${definition.tableName}
        SET
          ${definition.columns.isActive} = @IsActive,
          ${definition.columns.updatedAt} = SYSUTCDATETIME(),
          ${definition.columns.updatedBy} = @UpdatedBy
        OUTPUT
          ${buildOutputColumns(definition)}
        WHERE ${definition.columns.tenantId} = @TenantId
          AND ${definition.idColumn} = @Id
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "Id", value: id },
        { name: "IsActive", value: isActive },
        { name: "UpdatedBy", value: userId ?? null }
      ]
    );

    return result[0];
  }

  private async queryInTransaction<TRecord>(
    transaction: sql.Transaction,
    sqlText: string,
    parameters: readonly SqlParameter[] = []
  ): Promise<TRecord[]> {
    const request = new sql.Request(transaction);

    for (const parameter of parameters) {
      request.input(parameter.name, parameter.value);
    }

    const result = await request.query(sqlText);
    return result.recordset as TRecord[];
  }
}
