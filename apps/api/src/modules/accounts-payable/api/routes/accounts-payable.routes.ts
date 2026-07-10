import { Router } from "express";

import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { requireCompanyContext, requireTenantContext } from "../../../core/api/tenant-context.middleware.js";
import { requireAuth } from "../../../security/api/auth.middleware.js";
import { requirePermission } from "../../../security/api/permission.middleware.js";
import { getRequestContext } from "../../../../utils/requestContext.js";
import { sendSuccess } from "../../../../utils/responseBuilder.js";
import { validateRequest } from "../../../../utils/validateRequest.js";
import { supplierAdjustmentService } from "../../application/SupplierAdjustmentService.js";
import { supplierPaymentService } from "../../application/SupplierPaymentService.js";
import {
  supplierAdjustmentApplicationCreateSchema,
  supplierAdjustmentCreateSchema,
  supplierAdjustmentIdParamsSchema,
  supplierAdjustmentListQuerySchema
} from "../../validators/supplier-adjustment.validators.js";
import {
  supplierPaymentApplicationCreateSchema,
  supplierPaymentCreateSchema,
  supplierPaymentIdParamsSchema,
  supplierPaymentListQuerySchema
} from "../../validators/supplier-payment.validators.js";

export const accountsPayableRouter = Router();

accountsPayableRouter.use(requireAuth, requireTenantContext, requireCompanyContext);

function accountsPayableContext(request: Parameters<typeof getRequestContext>[0]) {
  const context = getRequestContext(request);

  return {
    tenantId: request.tenantContext!.tenantId,
    companyId: request.tenantContext!.companyId!,
    userId: context.userId,
    requestId: context.requestId,
    correlationId: context.correlationId
  };
}

accountsPayableRouter.get(
  "/adjustments",
  validateRequest({ query: supplierAdjustmentListQuerySchema }),
  requirePermission("purchasing", "ap.adjustments.read"),
  asyncHandler(async (request, response) => {
    const result = await supplierAdjustmentService.listSupplierAdjustments(
      accountsPayableContext(request),
      request.query
    );

    sendSuccess(response, result);
  })
);

accountsPayableRouter.get(
  "/adjustments/:id",
  validateRequest({ params: supplierAdjustmentIdParamsSchema }),
  requirePermission("purchasing", "ap.adjustments.read"),
  asyncHandler(async (request, response) => {
    const result = await supplierAdjustmentService.getSupplierAdjustment(
      accountsPayableContext(request),
      request.params.id!
    );

    sendSuccess(response, result);
  })
);

accountsPayableRouter.post(
  "/adjustments",
  validateRequest({ body: supplierAdjustmentCreateSchema }),
  requirePermission("purchasing", "ap.adjustments.create"),
  asyncHandler(async (request, response) => {
    const result = await supplierAdjustmentService.createSupplierAdjustment(
      accountsPayableContext(request),
      request.body
    );

    sendSuccess(response, result, 201);
  })
);

accountsPayableRouter.post(
  "/adjustments/:id/applications",
  validateRequest({ params: supplierAdjustmentIdParamsSchema, body: supplierAdjustmentApplicationCreateSchema }),
  requirePermission("purchasing", "ap.adjustments.update"),
  asyncHandler(async (request, response) => {
    const result = await supplierAdjustmentService.addApplication(
      accountsPayableContext(request),
      request.params.id!,
      request.body
    );

    sendSuccess(response, result, 201);
  })
);

accountsPayableRouter.post(
  "/adjustments/:id/post",
  validateRequest({ params: supplierAdjustmentIdParamsSchema }),
  requirePermission("purchasing", "ap.adjustments.post"),
  asyncHandler(async (request, response) => {
    const result = await supplierAdjustmentService.postSupplierAdjustment(
      accountsPayableContext(request),
      request.params.id!
    );

    sendSuccess(response, result);
  })
);

accountsPayableRouter.get(
  "/payments",
  validateRequest({ query: supplierPaymentListQuerySchema }),
  requirePermission("purchasing", "ap.payments.read"),
  asyncHandler(async (request, response) => {
    const result = await supplierPaymentService.listSupplierPayments(
      accountsPayableContext(request),
      request.query
    );

    sendSuccess(response, result);
  })
);

accountsPayableRouter.get(
  "/payments/:id",
  validateRequest({ params: supplierPaymentIdParamsSchema }),
  requirePermission("purchasing", "ap.payments.read"),
  asyncHandler(async (request, response) => {
    const result = await supplierPaymentService.getSupplierPayment(
      accountsPayableContext(request),
      request.params.id!
    );

    sendSuccess(response, result);
  })
);

accountsPayableRouter.post(
  "/payments",
  validateRequest({ body: supplierPaymentCreateSchema }),
  requirePermission("purchasing", "ap.payments.create"),
  asyncHandler(async (request, response) => {
    const result = await supplierPaymentService.createSupplierPayment(
      accountsPayableContext(request),
      request.body
    );

    sendSuccess(response, result, 201);
  })
);

accountsPayableRouter.post(
  "/payments/:id/applications",
  validateRequest({ params: supplierPaymentIdParamsSchema, body: supplierPaymentApplicationCreateSchema }),
  requirePermission("purchasing", "ap.payments.update"),
  asyncHandler(async (request, response) => {
    const result = await supplierPaymentService.addApplication(
      accountsPayableContext(request),
      request.params.id!,
      request.body
    );

    sendSuccess(response, result, 201);
  })
);

accountsPayableRouter.post(
  "/payments/:id/post",
  validateRequest({ params: supplierPaymentIdParamsSchema }),
  requirePermission("purchasing", "ap.payments.post"),
  asyncHandler(async (request, response) => {
    const result = await supplierPaymentService.postSupplierPayment(
      accountsPayableContext(request),
      request.params.id!
    );

    sendSuccess(response, result);
  })
);
