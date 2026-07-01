import type { RequestHandler } from "express";

import { recordFunctionalAuditEvent } from "../../audit/infrastructure/audit.repository.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { userHasPermission } from "../infrastructure/security.repository.js";

export function requirePermission(moduleCode: string, actionCode: string): RequestHandler {
  return async (request, _response, next) => {
    if (!request.user) {
      next(new AppError("Autenticacion requerida.", 401, "AUTH_REQUIRED"));
      return;
    }

    const tenantId = request.tenantContext?.tenantId ?? request.user.tenantId;
    const hasPermission = await userHasPermission({
      tenantId,
      userId: request.user.userId,
      moduleCode,
      actionCode
    });

    if (!hasPermission) {
      await recordFunctionalAuditEvent({
        tenantId,
        companyId: request.tenantContext?.companyId ?? request.user.companyId,
        userId: request.user.userId,
        action: "PERMISSION_DENIED",
        entityName: "security.Permissions",
        entityId: `${moduleCode}:${actionCode}`,
        metadata: {
          moduleCode,
          actionCode,
          path: request.originalUrl,
          method: request.method
        }
      });

      next(new AppError("Permiso insuficiente.", 403, "PERMISSION_DENIED"));
      return;
    }

    next();
  };
}
