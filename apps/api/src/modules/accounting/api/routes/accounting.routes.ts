import { Router } from "express";

import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { requireCompanyContext, requireTenantContext } from "../../../core/api/tenant-context.middleware.js";
import { requireAuth } from "../../../security/api/auth.middleware.js";
import { requirePermission } from "../../../security/api/permission.middleware.js";
import { getRequestContext } from "../../../../utils/requestContext.js";
import { sendSuccess } from "../../../../utils/responseBuilder.js";
import { validateRequest } from "../../../../utils/validateRequest.js";
import { accountingPeriodService } from "../../application/AccountingPeriodService.js";
import {
  accountingPeriodCreateSchema,
  accountingPeriodIdParamsSchema,
  accountingPeriodListQuerySchema,
  accountingPeriodReopenSchema,
  accountingPeriodUpdateSchema
} from "../../validators/accounting-period.validators.js";

export const accountingRouter = Router();

accountingRouter.use(requireAuth, requireTenantContext, requireCompanyContext);

function accountingContext(request: Parameters<typeof getRequestContext>[0]) {
  const context = getRequestContext(request);

  return {
    tenantId: request.tenantContext!.tenantId,
    companyId: request.tenantContext!.companyId!,
    userId: context.userId,
    requestId: context.requestId,
    correlationId: context.correlationId
  };
}

accountingRouter.get(
  "/periods",
  validateRequest({ query: accountingPeriodListQuerySchema }),
  requirePermission("accounting", "accounting.periods.read"),
  asyncHandler(async (request, response) => {
    const result = await accountingPeriodService.listPeriods(accountingContext(request), request.query);

    sendSuccess(response, result);
  })
);

accountingRouter.get(
  "/periods/:id",
  validateRequest({ params: accountingPeriodIdParamsSchema }),
  requirePermission("accounting", "accounting.periods.read"),
  asyncHandler(async (request, response) => {
    const result = await accountingPeriodService.getPeriod(accountingContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

accountingRouter.post(
  "/periods",
  validateRequest({ body: accountingPeriodCreateSchema }),
  requirePermission("accounting", "accounting.periods.create"),
  asyncHandler(async (request, response) => {
    const result = await accountingPeriodService.createPeriod(accountingContext(request), request.body);

    sendSuccess(response, result, 201);
  })
);

accountingRouter.patch(
  "/periods/:id",
  validateRequest({ params: accountingPeriodIdParamsSchema, body: accountingPeriodUpdateSchema }),
  requirePermission("accounting", "accounting.periods.update"),
  asyncHandler(async (request, response) => {
    const result = await accountingPeriodService.updatePeriod(
      accountingContext(request),
      request.params.id!,
      request.body
    );

    sendSuccess(response, result);
  })
);

accountingRouter.post(
  "/periods/:id/close",
  validateRequest({ params: accountingPeriodIdParamsSchema }),
  requirePermission("accounting", "accounting.periods.close"),
  asyncHandler(async (request, response) => {
    const result = await accountingPeriodService.closePeriod(accountingContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

accountingRouter.post(
  "/periods/:id/reopen",
  validateRequest({ params: accountingPeriodIdParamsSchema, body: accountingPeriodReopenSchema }),
  requirePermission("accounting", "accounting.periods.reopen"),
  asyncHandler(async (request, response) => {
    const result = await accountingPeriodService.reopenPeriod(
      accountingContext(request),
      request.params.id!,
      request.body
    );

    sendSuccess(response, result);
  })
);

accountingRouter.patch(
  "/periods/:id/deactivate",
  validateRequest({ params: accountingPeriodIdParamsSchema }),
  requirePermission("accounting", "accounting.periods.update"),
  asyncHandler(async (request, response) => {
    const result = await accountingPeriodService.deactivatePeriod(accountingContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);
