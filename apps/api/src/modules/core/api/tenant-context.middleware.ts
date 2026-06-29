import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error.js";

export const requireTenantContext: RequestHandler = (request, _response, next) => {
  const tenantId = request.header("x-tenant-id") ?? request.user?.tenantId;
  const companyId = request.header("x-company-id") ?? request.user?.companyId;

  if (!tenantId) {
    next(new AppError("Tenant requerido.", 400, "TENANT_REQUIRED"));
    return;
  }

  if (request.user && request.user.tenantId !== tenantId) {
    next(new AppError("El usuario no pertenece al tenant solicitado.", 403, "TENANT_FORBIDDEN"));
    return;
  }

  request.tenantContext = {
    tenantId,
    companyId
  };
  next();
};
