import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../../../security/api/auth.middleware.js";
import { recordFunctionalAuditEvent } from "../../../audit/infrastructure/audit.repository.js";
import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { createCompanyForUser, listCompaniesForUser, listTenants } from "../../infrastructure/company.repository.js";
import { requireTenantContext } from "../tenant-context.middleware.js";

export const coreRouter = Router();

const createCompanySchema = z.object({
  legalName: z.string().min(1).max(250),
  tradeName: z.string().max(250).optional(),
  taxId: z.string().max(32).optional()
});

coreRouter.use(requireAuth);

coreRouter.get("/me", requireTenantContext, (request, response) => {
  response.json({
    user: request.user,
    tenantContext: request.tenantContext
  });
});

coreRouter.get(
  "/tenants",
  asyncHandler(async (_request, response) => {
    const tenants = await listTenants();
    response.json({ data: tenants });
  })
);

coreRouter.get(
  "/companies",
  requireTenantContext,
  asyncHandler(async (request, response) => {
    const companies = await listCompaniesForUser(request.tenantContext!.tenantId, request.user!.userId);
    response.json({ data: companies });
  })
);

coreRouter.post(
  "/companies",
  requireTenantContext,
  asyncHandler(async (request, response) => {
    const body = createCompanySchema.parse(request.body);
    const company = await createCompanyForUser({
      tenantId: request.tenantContext!.tenantId,
      userId: request.user!.userId,
      legalName: body.legalName,
      tradeName: body.tradeName,
      taxId: body.taxId
    });

    await recordFunctionalAuditEvent({
      tenantId: request.tenantContext!.tenantId,
      companyId: company.CompanyId,
      userId: request.user!.userId,
      action: "COMPANY_CREATED",
      entityName: "core.Companies",
      entityId: company.CompanyId
    });

    response.status(201).json({ data: company });
  })
);
