import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Router } from "express";

import { NotFoundError } from "../../../../errors/index.js";
import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { getBaseFilters } from "../../../../utils/filters.js";
import { getPagination, getPaginationMeta } from "../../../../utils/pagination.js";
import { getRequestContext } from "../../../../utils/requestContext.js";
import { sendSuccess } from "../../../../utils/responseBuilder.js";
import { getSorting } from "../../../../utils/sorting.js";
import { validateRequest } from "../../../../utils/validateRequest.js";
import { requireTenantContext } from "../../../core/api/tenant-context.middleware.js";
import { requireAuth } from "../../../security/api/auth.middleware.js";
import { requireFeatureFlag } from "../../../security/api/feature-flag.middleware.js";
import { requireLicensedModule } from "../../../security/api/licensed-module.middleware.js";
import { requirePermission } from "../../../security/api/permission.middleware.js";
import { baseCatalogService } from "../../application/BaseCatalogService.js";
import type { CatalogDefinition, CatalogPermissionSet } from "../../domain/catalog-definition.js";
import { getCatalogDefinition } from "../../domain/catalog-definition.js";
import {
  catalogImportPreviewSchema,
  catalogLookupQuerySchema,
  catalogParamsSchema,
  catalogPayloadSchema,
  catalogQuerySchema
} from "../../validators/catalog.validators.js";

type CatalogOperation = keyof CatalogPermissionSet;

export const masterDataRouter = Router();

masterDataRouter.use(requireAuth, requireTenantContext);

function resolveCatalog(request: Request): CatalogDefinition {
  const definition = getCatalogDefinition(request.params.catalog);

  if (!definition) {
    throw new NotFoundError("Catalog not found", { catalog: request.params.catalog }, "CATALOG_NOT_FOUND");
  }

  return definition;
}

function runMiddleware(handler: RequestHandler, request: Request, response: Response) {
  return new Promise<void>((resolve, reject) => {
    handler(request, response, (error?: unknown) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function requireCatalogAccess(operation: CatalogOperation): RequestHandler {
  return async (request, response, next: NextFunction) => {
    try {
      const definition = resolveCatalog(request);
      await runMiddleware(
        requirePermission(definition.moduleCode, definition.permissions[operation]),
        request,
        response
      );

      if (definition.licenseRequirement) {
        await runMiddleware(requireLicensedModule(definition.licenseRequirement), request, response);
      }

      if (definition.featureFlagRequirement) {
        await runMiddleware(requireFeatureFlag(definition.featureFlagRequirement), request, response);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

function catalogContext(request: Request) {
  const context = getRequestContext(request);

  return {
    tenantId: request.tenantContext!.tenantId,
    companyId: request.tenantContext?.companyId ?? context.companyId,
    userId: context.userId,
    requestId: context.requestId,
    correlationId: context.correlationId
  };
}

masterDataRouter.get(
  "/:catalog/metadata",
  validateRequest({ params: catalogParamsSchema }),
  requireCatalogAccess("read"),
  asyncHandler(async (request, response) => {
    const metadata = baseCatalogService.getMetadata(resolveCatalog(request));
    sendSuccess(response, metadata);
  })
);

masterDataRouter.get(
  "/:catalog/lookup",
  validateRequest({ params: catalogParamsSchema, query: catalogLookupQuerySchema }),
  requireCatalogAccess("lookup"),
  asyncHandler(async (request, response) => {
    const definition = resolveCatalog(request);
    const pagination = getPagination(request.query);
    const context = catalogContext(request);
    const result = await baseCatalogService.lookup(definition, {
      tenantId: context.tenantId,
      companyId: context.companyId,
      filters: {
        search: typeof request.query.search === "string" ? request.query.search : undefined,
        isActive: true
      },
      pagination,
      sorting: {
        sortBy: definition.defaultSortBy,
        sortDirection: "asc"
      }
    });

    sendSuccess(response, result.items, 200, undefined, {
      pagination: getPaginationMeta(pagination, result.totalItems)
    });
  })
);

masterDataRouter.get(
  "/:catalog/export-template",
  validateRequest({ params: catalogParamsSchema }),
  requireCatalogAccess("export"),
  asyncHandler(async (request, response) => {
    const contract = baseCatalogService.getExportTemplate(resolveCatalog(request));
    sendSuccess(response, contract);
  })
);

masterDataRouter.post(
  "/:catalog/import-preview",
  validateRequest({ params: catalogParamsSchema, body: catalogImportPreviewSchema }),
  requireCatalogAccess("import"),
  asyncHandler(async (request, response) => {
    const contract = baseCatalogService.getImportPreview(resolveCatalog(request));
    sendSuccess(response, contract, 202);
  })
);

masterDataRouter.get(
  "/:catalog",
  validateRequest({ params: catalogParamsSchema, query: catalogQuerySchema }),
  requireCatalogAccess("read"),
  asyncHandler(async (request, response) => {
    const definition = resolveCatalog(request);
    const pagination = getPagination(request.query);
    const filters = getBaseFilters(request.query as Record<string, unknown>);
    const sorting = getSorting(
      request.query,
      definition.allowedSortColumns,
      definition.defaultSortBy
    );
    const context = catalogContext(request);
    const result = await baseCatalogService.list(definition, {
      tenantId: context.tenantId,
      companyId: context.companyId,
      filters,
      pagination,
      sorting
    });

    sendSuccess(response, result.items, 200, undefined, {
      pagination: getPaginationMeta(pagination, result.totalItems)
    });
  })
);

masterDataRouter.get(
  "/:catalog/:id",
  validateRequest({ params: catalogParamsSchema }),
  requireCatalogAccess("read"),
  asyncHandler(async (request, response) => {
    const item = await baseCatalogService.getById(
      resolveCatalog(request),
      catalogContext(request),
      request.params.id!
    );
    sendSuccess(response, item);
  })
);

masterDataRouter.post(
  "/:catalog",
  validateRequest({ params: catalogParamsSchema, body: catalogPayloadSchema }),
  requireCatalogAccess("create"),
  asyncHandler(async (request, response) => {
    const item = await baseCatalogService.create(resolveCatalog(request), catalogContext(request), {
      tenantId: request.tenantContext!.tenantId,
      ...request.body
    });
    sendSuccess(response, item, 201);
  })
);

masterDataRouter.put(
  "/:catalog/:id",
  validateRequest({ params: catalogParamsSchema, body: catalogPayloadSchema }),
  requireCatalogAccess("update"),
  asyncHandler(async (request, response) => {
    const item = await baseCatalogService.update(
      resolveCatalog(request),
      catalogContext(request),
      request.params.id!,
      {
        tenantId: request.tenantContext!.tenantId,
        ...request.body
      }
    );
    sendSuccess(response, item);
  })
);

masterDataRouter.delete(
  "/:catalog/:id",
  validateRequest({ params: catalogParamsSchema }),
  requireCatalogAccess("deactivate"),
  asyncHandler(async (request, response) => {
    const item = await baseCatalogService.deactivate(
      resolveCatalog(request),
      catalogContext(request),
      request.params.id!
    );
    sendSuccess(response, item);
  })
);

masterDataRouter.patch(
  "/:catalog/:id/activate",
  validateRequest({ params: catalogParamsSchema }),
  requireCatalogAccess("activate"),
  asyncHandler(async (request, response) => {
    const item = await baseCatalogService.activate(
      resolveCatalog(request),
      catalogContext(request),
      request.params.id!
    );
    sendSuccess(response, item);
  })
);

masterDataRouter.patch(
  "/:catalog/:id/deactivate",
  validateRequest({ params: catalogParamsSchema }),
  requireCatalogAccess("deactivate"),
  asyncHandler(async (request, response) => {
    const item = await baseCatalogService.deactivate(
      resolveCatalog(request),
      catalogContext(request),
      request.params.id!
    );
    sendSuccess(response, item);
  })
);
