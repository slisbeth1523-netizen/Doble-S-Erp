import type { BaseFilters, Pagination, Sorting } from "@doble-s-erp/shared";

import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
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
}
