import type { Request } from "express";
import type { RequestContext } from "@doble-s-erp/shared";

export function getRequestContext(request: Request): RequestContext {
  const existingContext = request.requestContext;

  return {
    tenantId: request.tenantContext?.tenantId ?? request.user?.tenantId,
    companyId: request.tenantContext?.companyId ?? request.user?.companyId,
    userId: request.user?.userId,
    jwtId: request.user?.jwtId,
    permissions: existingContext?.permissions ?? [],
    requestId: existingContext?.requestId ?? "",
    correlationId: existingContext?.correlationId ?? existingContext?.requestId ?? ""
  };
}
