import { ConflictError, ForbiddenError, ValidationError } from "../../../errors/index.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import type { CatalogDefinition, CatalogFieldDefinition } from "../domain/catalog-definition.js";
import {
  BaseCatalogRepository,
  type CatalogListInput,
  type CatalogWriteInput
} from "../infrastructure/BaseCatalogRepository.js";

export type CatalogContext = {
  tenantId: string;
  companyId?: string;
  userId?: string;
  requestId?: string;
  correlationId?: string;
};

export class BaseCatalogService extends BaseService {
  constructor(private readonly repository = new BaseCatalogRepository()) {
    super();
  }

  list(definition: CatalogDefinition, input: CatalogListInput) {
    return this.repository.list(definition, input);
  }

  getMetadata(definition: CatalogDefinition) {
    const fields = [...definition.fields].sort((left, right) => left.displayOrder - right.displayOrder);
    const actions = this.getRuntimeActions(definition);

    return {
      catalog: {
        code: definition.catalogCode,
        displayName: definition.displayName,
        tenantScoped: definition.tenantScoped,
        companyScoped: definition.companyScoped,
        readOnly: definition.readOnly ?? false
      },
      fields,
      grid: {
        columns: fields
          .filter((field) => field.visibleInGrid)
          .map((field) => ({
            field: field.field,
            label: field.label,
            type: field.type,
            order: field.displayOrder,
            width: field.grid?.width,
            align: field.grid?.align ?? "left",
            format: field.grid?.format,
            sortable: field.sortable,
            searchable: field.searchable
          })),
        sortableColumns: fields.filter((field) => field.sortable).map((field) => field.field),
        searchableColumns: fields.filter((field) => field.searchable).map((field) => field.field)
      },
      form: {
        fields: fields
          .filter((field) => field.visibleInForm)
          .map((field) => ({
            field: field.field,
            label: field.label,
            inputType: field.type,
            order: field.displayOrder,
            required: field.required,
            readOnly: field.readOnly,
            editable: field.editable,
            defaultValue: field.defaultValue,
            placeholder: field.placeholder,
            helpText: field.helpText,
            lookupCatalog: field.lookupCatalog,
            validation: field.validation
          }))
      },
      validations: Object.fromEntries(fields.map((field) => [field.field, field.validation])),
      actions,
      permissions: definition.permissions,
      requirements: {
        license: definition.licenseRequirement ?? null,
        featureFlag: definition.featureFlagRequirement ?? null
      }
    };
  }

  async lookup(definition: CatalogDefinition, input: CatalogListInput) {
    const result = await this.repository.list(definition, input);
    return {
      items: result.items.map((item) => ({
        value: String(item.id),
        label: String(item.name),
        code: typeof item.code === "string" ? item.code : undefined,
        isActive: typeof item.isActive === "boolean" ? item.isActive : undefined
      })),
      totalItems: result.totalItems
    };
  }

  getExportTemplate(definition: CatalogDefinition) {
    const fields = definition.fields
      .filter((field) => field.visibleInForm && field.editable)
      .sort((left, right) => left.displayOrder - right.displayOrder);

    return {
      catalog: definition.catalogCode,
      status: "prepared",
      available: false,
      message: "Export template contract is prepared but file generation is not available yet.",
      columns: fields.map((field) => ({
        field: field.field,
        label: field.label,
        type: field.type,
        required: field.required,
        validation: field.validation
      }))
    };
  }

  getImportPreview(definition: CatalogDefinition) {
    return {
      catalog: definition.catalogCode,
      status: "prepared",
      available: false,
      message: "Import preview contract is prepared but processing is not available yet.",
      acceptedFields: definition.fields
        .filter((field) => field.visibleInForm && field.editable)
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((field) => ({
          field: field.field,
          label: field.label,
          type: field.type,
          required: field.required,
          validation: field.validation
        }))
    };
  }

  async getById(definition: CatalogDefinition, context: CatalogContext, id: string) {
    const item = await this.repository.findById(definition, context.tenantId, id, context.companyId);
    return this.ensureFound(item, `${definition.displayName} item not found`);
  }

  async getByCode(definition: CatalogDefinition, context: CatalogContext, code: string) {
    const item = await this.repository.findByCode(
      definition,
      context.tenantId,
      code,
      context.companyId
    );
    return this.ensureFound(item, `${definition.displayName} item not found`);
  }

  async create(definition: CatalogDefinition, context: CatalogContext, input: CatalogWriteInput) {
    this.ensureWritable(definition);
    const normalizedInput = {
      ...input,
      tenantId: context.tenantId,
      companyId: definition.companyScoped ? input.companyId ?? context.companyId : null,
      userId: context.userId
    };
    this.validatePayload(definition, normalizedInput);
    await this.prepareSpecialCatalogPayload(definition, context, normalizedInput);
    await this.ensureUniqueCode(definition, context, normalizedInput.code, normalizedInput.companyId);
    const item = await this.repository.create(definition, normalizedInput);

    logger.info("Master data item created", {
      catalog: definition.catalogCode,
      tenantId: context.tenantId,
      itemId: item.id
    });
    await this.audit(definition, context, "MASTER_DATA_ITEM_CREATED", item.id);
    return item;
  }

  async update(
    definition: CatalogDefinition,
    context: CatalogContext,
    id: string,
    input: CatalogWriteInput
  ) {
    this.ensureWritable(definition);
    const normalizedInput = {
      ...input,
      tenantId: context.tenantId,
      companyId: definition.companyScoped ? input.companyId ?? context.companyId : null,
      userId: context.userId
    };
    this.validatePayload(definition, normalizedInput);
    await this.prepareSpecialCatalogPayload(definition, context, normalizedInput, id);
    await this.ensureUniqueCode(definition, context, normalizedInput.code, normalizedInput.companyId, id);
    const item = await this.repository.update(definition, id, normalizedInput);

    const found = this.ensureFound(item, `${definition.displayName} item not found`);
    logger.info("Master data item updated", {
      catalog: definition.catalogCode,
      tenantId: context.tenantId,
      itemId: id
    });
    await this.audit(definition, context, "MASTER_DATA_ITEM_UPDATED", id);
    return found;
  }

  async activate(definition: CatalogDefinition, context: CatalogContext, id: string) {
    this.ensureWritable(definition);
    const item = await this.repository.setActive(definition, context.tenantId, id, true, context.userId);
    const found = this.ensureFound(item, `${definition.displayName} item not found`);
    await this.audit(definition, context, "MASTER_DATA_ITEM_ACTIVATED", id);
    return found;
  }

  async deactivate(definition: CatalogDefinition, context: CatalogContext, id: string) {
    this.ensureWritable(definition);
    const item = await this.repository.setActive(definition, context.tenantId, id, false, context.userId);
    const found = this.ensureFound(item, `${definition.displayName} item not found`);
    await this.audit(definition, context, "MASTER_DATA_ITEM_DEACTIVATED", id);
    return found;
  }

  private async ensureUniqueCode(
    definition: CatalogDefinition,
    context: CatalogContext,
    code: string,
    companyId?: string | null,
    excludeId?: string
  ) {
    const exists = await this.repository.codeExists(
      definition,
      context.tenantId,
      code,
      definition.companyScoped ? companyId ?? context.companyId : null,
      excludeId
    );

    if (exists) {
      throw new ConflictError(`${definition.displayName} code already exists`, undefined, "CATALOG_CODE_EXISTS");
    }
  }

  private getRuntimeActions(definition: CatalogDefinition) {
    const writeAvailable = !definition.readOnly;

    return [
      { action: "create", permission: definition.permissions.create, available: writeAvailable },
      { action: "update", permission: definition.permissions.update, available: writeAvailable },
      { action: "activate", permission: definition.permissions.activate, available: writeAvailable },
      { action: "deactivate", permission: definition.permissions.deactivate, available: writeAvailable },
      { action: "lookup", permission: definition.permissions.lookup },
      { action: "export", permission: definition.permissions.export, available: !definition.readOnly },
      { action: "import", permission: definition.permissions.import, available: !definition.readOnly }
    ];
  }

  private ensureWritable(definition: CatalogDefinition) {
    if (definition.readOnly) {
      throw new ForbiddenError(
        `${definition.displayName} is read-only in this runtime phase`,
        { catalog: definition.catalogCode },
        "CATALOG_READ_ONLY"
      );
    }
  }

  private validatePayload(definition: CatalogDefinition, input: CatalogWriteInput) {
    const errors = definition.fields
      .filter((field) => field.visibleInForm && field.editable)
      .flatMap((field) => this.validateField(field, input[field.field]));

    if (errors.length > 0) {
      throw new ValidationError("Catalog payload validation failed", errors, "CATALOG_VALIDATION_ERROR");
    }
  }

  private async prepareSpecialCatalogPayload(
    definition: CatalogDefinition,
    context: CatalogContext,
    input: CatalogWriteInput,
    currentId?: string
  ) {
    if (definition.catalogCode !== "cost-centers") {
      return;
    }

    if (!input.companyId && !context.companyId) {
      throw new ValidationError(
        "Cost center requires company context",
        [{ field: "companyId", message: "Company context is required" }],
        "COST_CENTER_COMPANY_REQUIRED"
      );
    }

    this.validateCostCenterDates(input);
    const parentId = typeof input.parentId === "string" && input.parentId.trim() ? input.parentId : null;

    if (currentId && parentId?.toLowerCase() === currentId.toLowerCase()) {
      throw new ConflictError(
        "Cost center cannot be its own parent",
        { costCenterId: currentId },
        "COST_CENTER_SELF_PARENT"
      );
    }

    if (!parentId) {
      input.parentId = null;
      input.level = 1;
      return;
    }

    const parent = await this.repository.findById(definition, context.tenantId, parentId, input.companyId ?? context.companyId);
    if (!parent || parent.companyId !== (input.companyId ?? context.companyId)) {
      throw new ValidationError(
        "Parent cost center was not found in the active company",
        [{ field: "parentId", message: "Parent cost center must belong to the same company" }],
        "COST_CENTER_PARENT_NOT_FOUND"
      );
    }

    if (currentId) {
      await this.ensureCostCenterHasNoCycle(definition, context, currentId, parentId, input.companyId ?? context.companyId);
    }

    input.parentId = parentId;
    input.level = Number(parent.level ?? 0) + 1;
  }

  private validateCostCenterDates(input: CatalogWriteInput) {
    const validFrom = typeof input.validFrom === "string" && input.validFrom ? new Date(input.validFrom) : null;
    const validTo = typeof input.validTo === "string" && input.validTo ? new Date(input.validTo) : null;

    if (validFrom && Number.isNaN(validFrom.getTime())) {
      throw new ValidationError(
        "Cost center valid from date is invalid",
        [{ field: "validFrom", message: "Valid from must be a valid date" }],
        "COST_CENTER_INVALID_DATE"
      );
    }

    if (validTo && Number.isNaN(validTo.getTime())) {
      throw new ValidationError(
        "Cost center valid to date is invalid",
        [{ field: "validTo", message: "Valid to must be a valid date" }],
        "COST_CENTER_INVALID_DATE"
      );
    }

    if (validFrom && validTo && validTo < validFrom) {
      throw new ValidationError(
        "Cost center valid to date cannot be before valid from date",
        [{ field: "validTo", message: "Valid to cannot be before valid from" }],
        "COST_CENTER_INVALID_DATE_RANGE"
      );
    }
  }

  private async ensureCostCenterHasNoCycle(
    definition: CatalogDefinition,
    context: CatalogContext,
    currentId: string,
    parentId: string,
    companyId?: string | null
  ) {
    const visited = new Set<string>();
    let nextParentId: string | null = parentId;

    while (nextParentId) {
      const normalized = nextParentId.toLowerCase();
      if (normalized === currentId.toLowerCase()) {
        throw new ConflictError(
          "Cost center hierarchy cannot contain cycles",
          { costCenterId: currentId, parentId },
          "COST_CENTER_HIERARCHY_CYCLE"
        );
      }

      if (visited.has(normalized)) {
        throw new ConflictError(
          "Cost center hierarchy contains a cycle",
          { costCenterId: currentId, parentId },
          "COST_CENTER_HIERARCHY_CYCLE"
        );
      }

      visited.add(normalized);
      const parent = await this.repository.findById(definition, context.tenantId, nextParentId, companyId ?? context.companyId);
      nextParentId = typeof parent?.parentId === "string" ? parent.parentId : null;
    }
  }

  private validateField(field: CatalogFieldDefinition, value: unknown) {
    const errors: Array<{ field: string; message: string }> = [];
    const isEmpty = value === undefined || value === null || value === "";

    if ((field.required || field.validation.required) && isEmpty) {
      errors.push({ field: field.field, message: `${field.label} is required` });
      return errors;
    }

    if (isEmpty) {
      return errors;
    }

    if (typeof value === "string") {
      if (field.validation.minLength !== undefined && value.length < field.validation.minLength) {
        errors.push({ field: field.field, message: `${field.label} is too short` });
      }

      if (field.validation.maxLength !== undefined && value.length > field.validation.maxLength) {
        errors.push({ field: field.field, message: `${field.label} is too long` });
      }

      if (field.validation.regex && !new RegExp(field.validation.regex).test(value)) {
        errors.push({ field: field.field, message: `${field.label} format is invalid` });
      }
    }

    if (typeof value === "number") {
      if (field.validation.min !== undefined && value < field.validation.min) {
        errors.push({ field: field.field, message: `${field.label} is below the minimum` });
      }

      if (field.validation.max !== undefined && value > field.validation.max) {
        errors.push({ field: field.field, message: `${field.label} is above the maximum` });
      }
    }

    return errors;
  }

  private audit(
    definition: CatalogDefinition,
    context: CatalogContext,
    action: string,
    entityId: unknown
  ) {
    return auditEvent({
      tenantId: context.tenantId,
      companyId: context.companyId,
      userId: context.userId,
      action,
      entity: definition.tableName,
      entityId: typeof entityId === "string" ? entityId : undefined,
      metadata: {
        catalog: definition.catalogCode,
        requestId: context.requestId,
        correlationId: context.correlationId
      }
    });
  }
}

export const baseCatalogService = new BaseCatalogService();
