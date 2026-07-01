import type { RequestHandler } from "express";

import { ForbiddenError, UnauthorizedError } from "../../../errors/index.js";
import { logger } from "../../../utils/logger.js";
import { getRequestContext } from "../../../utils/requestContext.js";
import { securityEngineService } from "../application/security-engine.service.js";

export function requireLicensedModule(moduleCode: string): RequestHandler {
  return async (request, _response, next) => {
    try {
      const context = getRequestContext(request);

      if (!context.tenantId) {
        next(new UnauthorizedError("Tenant context is required", undefined, "TENANT_CONTEXT_REQUIRED"));
        return;
      }

      const licensed = await securityEngineService.isModuleLicensed(context.tenantId, moduleCode);

      if (!licensed) {
        logger.warn("Licensed module required but not available", {
          tenantId: context.tenantId,
          moduleCode,
          requestId: context.requestId
        });
        next(new ForbiddenError("Module is not licensed for this tenant", undefined, "MODULE_NOT_LICENSED"));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
