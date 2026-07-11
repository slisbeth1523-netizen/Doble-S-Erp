import { Router } from "express";

import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { requireCompanyContext, requireTenantContext } from "../../../core/api/tenant-context.middleware.js";
import { requireAuth } from "../../../security/api/auth.middleware.js";
import { requirePermission } from "../../../security/api/permission.middleware.js";
import { getRequestContext } from "../../../../utils/requestContext.js";
import { sendSuccess } from "../../../../utils/responseBuilder.js";
import { validateRequest } from "../../../../utils/validateRequest.js";
import { accountsReceivableDocumentService } from "../../application/AccountsReceivableDocumentService.js";
import {
  accountsReceivableDocumentCreateSchema,
  accountsReceivableDocumentIdParamsSchema,
  accountsReceivableDocumentListQuerySchema,
  customerBalanceListQuerySchema,
  customerBalanceParamsSchema
} from "../../validators/accounts-receivable-document.validators.js";

export const accountsReceivableRouter = Router();

accountsReceivableRouter.use(requireAuth, requireTenantContext, requireCompanyContext);

function accountsReceivableContext(request: Parameters<typeof getRequestContext>[0]) {
  const context = getRequestContext(request);

  return {
    tenantId: request.tenantContext!.tenantId,
    companyId: request.tenantContext!.companyId!,
    userId: context.userId,
    requestId: context.requestId,
    correlationId: context.correlationId
  };
}

accountsReceivableRouter.get(
  "/documents",
  validateRequest({ query: accountsReceivableDocumentListQuerySchema }),
  requirePermission("receivables", "ar.documents.read"),
  asyncHandler(async (request, response) => {
    const result = await accountsReceivableDocumentService.listDocuments(
      accountsReceivableContext(request),
      request.query
    );

    sendSuccess(response, result);
  })
);

accountsReceivableRouter.get(
  "/documents/:id",
  validateRequest({ params: accountsReceivableDocumentIdParamsSchema }),
  requirePermission("receivables", "ar.documents.read"),
  asyncHandler(async (request, response) => {
    const result = await accountsReceivableDocumentService.getDocument(
      accountsReceivableContext(request),
      request.params.id!
    );

    sendSuccess(response, result);
  })
);

accountsReceivableRouter.post(
  "/documents",
  validateRequest({ body: accountsReceivableDocumentCreateSchema }),
  requirePermission("receivables", "ar.documents.create"),
  asyncHandler(async (request, response) => {
    const result = await accountsReceivableDocumentService.createDocument(
      accountsReceivableContext(request),
      request.body
    );

    sendSuccess(response, result, 201);
  })
);

accountsReceivableRouter.get(
  "/customer-balances",
  validateRequest({ query: customerBalanceListQuerySchema }),
  requirePermission("receivables", "ar.customer-balances.read"),
  asyncHandler(async (request, response) => {
    const result = await accountsReceivableDocumentService.listCustomerBalances(
      accountsReceivableContext(request),
      request.query
    );

    sendSuccess(response, result);
  })
);

accountsReceivableRouter.get(
  "/customer-balances/:customerId",
  validateRequest({ params: customerBalanceParamsSchema }),
  requirePermission("receivables", "ar.customer-balances.read"),
  asyncHandler(async (request, response) => {
    const result = await accountsReceivableDocumentService.getCustomerBalance(
      accountsReceivableContext(request),
      request.params.customerId!
    );

    sendSuccess(response, result);
  })
);
