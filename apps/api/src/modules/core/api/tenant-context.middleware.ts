import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error.js";
import { userHasCompanyAccess } from "../infrastructure/company.repository.js";

export const requireTenantContext: RequestHandler = async (request, _response, next) => {
  const tenantId = request.header("x-tenant-id") ?? request.user?.tenantId;
  const requestedCompanyId = request.header("x-company-id");
  const companyId = requestedCompanyId ?? request.user?.companyId;

  if (!tenantId) {
    next(new AppError("Tenant requerido.", 400, "TENANT_REQUIRED"));
    return;
  }

  if (request.user && request.user.tenantId !== tenantId) {
    next(new AppError("El usuario no pertenece al tenant solicitado.", 403, "TENANT_FORBIDDEN"));
    return;
  }

  try {
    if (request.user && requestedCompanyId) {
      const hasAccess = await userHasCompanyAccess({
        tenantId,
        userId: request.user.userId,
        companyId: requestedCompanyId
      });

      if (!hasAccess) {
        next(new AppError("El usuario no tiene acceso a la empresa solicitada.", 403, "COMPANY_FORBIDDEN"));
        return;
      }
    }

    request.tenantContext = {
      tenantId,
      companyId
    };
    next();
  } catch (error) {
    next(error);
  }
};

export const requireCompanyContext: RequestHandler = (request, _response, next) => {
  if (!request.tenantContext?.companyId) {
    next(new AppError("Empresa requerida.", 400, "COMPANY_REQUIRED"));
    return;
  }

  next();
};
