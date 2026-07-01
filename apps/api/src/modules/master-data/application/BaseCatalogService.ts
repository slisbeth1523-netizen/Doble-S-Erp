import { ConflictError } from "../../../errors/index.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import type { CatalogDefinition } from "../domain/catalog-definition.js";
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
    await this.ensureUniqueCode(definition, context, input.code, input.companyId);
    const item = await this.repository.create(definition, {
      ...input,
      tenantId: context.tenantId,
      companyId: definition.companyScoped ? input.companyId ?? context.companyId : null,
      userId: context.userId
    });

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
    await this.ensureUniqueCode(definition, context, input.code, input.companyId, id);
    const item = await this.repository.update(definition, id, {
      ...input,
      tenantId: context.tenantId,
      companyId: definition.companyScoped ? input.companyId ?? context.companyId : null,
      userId: context.userId
    });

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
    const item = await this.repository.setActive(definition, context.tenantId, id, true, context.userId);
    const found = this.ensureFound(item, `${definition.displayName} item not found`);
    await this.audit(definition, context, "MASTER_DATA_ITEM_ACTIVATED", id);
    return found;
  }

  async deactivate(definition: CatalogDefinition, context: CatalogContext, id: string) {
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
