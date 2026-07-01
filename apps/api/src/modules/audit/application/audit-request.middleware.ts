import type { RequestHandler } from "express";

import { recordAuditEvent } from "../infrastructure/audit.repository.js";

export const auditRequest: RequestHandler = (request, response, next) => {
  response.on("finish", () => {
    if (request.path === "/health") {
      return;
    }

    void recordAuditEvent({
      tenantId: request.tenantContext?.tenantId ?? request.user?.tenantId,
      companyId: request.tenantContext?.companyId ?? request.user?.companyId,
      userId: request.user?.userId,
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      ipAddress: request.ip,
      userAgent: request.header("user-agent")
    }).catch(() => {
      // Audit failures must not break the business request.
    });
  });

  next();
};

