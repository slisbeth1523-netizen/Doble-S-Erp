import type { RequestHandler } from "express";

import { ForbiddenError, UnauthorizedError } from "../../../errors/index.js";
import { logger } from "../../../utils/logger.js";
import { getRequestContext } from "../../../utils/requestContext.js";
import { securityEngineService } from "../application/security-engine.service.js";

export function requireFeatureFlag(flagCode: string): RequestHandler {
  return async (request, _response, next) => {
    try {
      const context = getRequestContext(request);

      if (!context.tenantId) {
        next(new UnauthorizedError("Tenant context is required", undefined, "TENANT_CONTEXT_REQUIRED"));
        return;
      }

      const enabled = await securityEngineService.isFeatureFlagEnabled(context.tenantId, flagCode);

      if (!enabled) {
        logger.warn("Feature flag required but disabled", {
          tenantId: context.tenantId,
          flagCode,
          requestId: context.requestId
        });
        next(new ForbiddenError("Feature flag is disabled", undefined, "FEATURE_FLAG_DISABLED"));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
