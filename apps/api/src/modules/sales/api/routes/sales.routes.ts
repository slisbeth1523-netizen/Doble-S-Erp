import { Router } from "express";

import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { requireCompanyContext, requireTenantContext } from "../../../core/api/tenant-context.middleware.js";
import { requireAuth } from "../../../security/api/auth.middleware.js";
import { requirePermission } from "../../../security/api/permission.middleware.js";
import { getRequestContext } from "../../../../utils/requestContext.js";
import { sendSuccess } from "../../../../utils/responseBuilder.js";
import { validateRequest } from "../../../../utils/validateRequest.js";
import { salesQuotationService } from "../../application/SalesQuotationService.js";
import {
  salesQuotationCreateSchema,
  salesQuotationIdParamsSchema,
  salesQuotationLineCreateSchema,
  salesQuotationLineIdParamsSchema,
  salesQuotationLineUpdateSchema,
  salesQuotationListQuerySchema,
  salesQuotationUpdateSchema
} from "../../validators/sales-quotation.validators.js";

export const salesRouter = Router();

salesRouter.use(requireAuth, requireTenantContext, requireCompanyContext);

function salesContext(request: Parameters<typeof getRequestContext>[0]) {
  const context = getRequestContext(request);

  return {
    tenantId: request.tenantContext!.tenantId,
    companyId: request.tenantContext!.companyId!,
    userId: context.userId,
    requestId: context.requestId,
    correlationId: context.correlationId
  };
}

salesRouter.get(
  "/quotations",
  validateRequest({ query: salesQuotationListQuerySchema }),
  requirePermission("sales", "sales.quotations.read"),
  asyncHandler(async (request, response) => {
    const result = await salesQuotationService.listQuotations(salesContext(request), request.query);

    sendSuccess(response, result);
  })
);

salesRouter.get(
  "/quotations/:id",
  validateRequest({ params: salesQuotationIdParamsSchema }),
  requirePermission("sales", "sales.quotations.read"),
  asyncHandler(async (request, response) => {
    const result = await salesQuotationService.getQuotation(salesContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/quotations",
  validateRequest({ body: salesQuotationCreateSchema }),
  requirePermission("sales", "sales.quotations.create"),
  asyncHandler(async (request, response) => {
    const result = await salesQuotationService.createQuotation(salesContext(request), request.body);

    sendSuccess(response, result, 201);
  })
);

salesRouter.patch(
  "/quotations/:id",
  validateRequest({ params: salesQuotationIdParamsSchema, body: salesQuotationUpdateSchema }),
  requirePermission("sales", "sales.quotations.update"),
  asyncHandler(async (request, response) => {
    const result = await salesQuotationService.updateQuotation(
      salesContext(request),
      request.params.id!,
      request.body
    );

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/quotations/:id/lines",
  validateRequest({ params: salesQuotationIdParamsSchema, body: salesQuotationLineCreateSchema }),
  requirePermission("sales", "sales.quotations.update"),
  asyncHandler(async (request, response) => {
    const result = await salesQuotationService.addLine(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result, 201);
  })
);

salesRouter.patch(
  "/quotations/:id/lines/:lineId",
  validateRequest({ params: salesQuotationLineIdParamsSchema, body: salesQuotationLineUpdateSchema }),
  requirePermission("sales", "sales.quotations.update"),
  asyncHandler(async (request, response) => {
    const result = await salesQuotationService.updateLine(
      salesContext(request),
      request.params.id!,
      request.params.lineId!,
      request.body
    );

    sendSuccess(response, result);
  })
);

salesRouter.delete(
  "/quotations/:id/lines/:lineId",
  validateRequest({ params: salesQuotationLineIdParamsSchema }),
  requirePermission("sales", "sales.quotations.update"),
  asyncHandler(async (request, response) => {
    const result = await salesQuotationService.deleteLine(
      salesContext(request),
      request.params.id!,
      request.params.lineId!
    );

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/quotations/:id/send",
  validateRequest({ params: salesQuotationIdParamsSchema }),
  requirePermission("sales", "sales.quotations.send"),
  asyncHandler(async (request, response) => {
    const result = await salesQuotationService.sendQuotation(salesContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/quotations/:id/approve",
  validateRequest({ params: salesQuotationIdParamsSchema }),
  requirePermission("sales", "sales.quotations.approve"),
  asyncHandler(async (request, response) => {
    const result = await salesQuotationService.approveQuotation(salesContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/quotations/:id/reject",
  validateRequest({ params: salesQuotationIdParamsSchema }),
  requirePermission("sales", "sales.quotations.reject"),
  asyncHandler(async (request, response) => {
    const result = await salesQuotationService.rejectQuotation(salesContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/quotations/:id/expire",
  validateRequest({ params: salesQuotationIdParamsSchema }),
  requirePermission("sales", "sales.quotations.expire"),
  asyncHandler(async (request, response) => {
    const result = await salesQuotationService.expireQuotation(salesContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);
