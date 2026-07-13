import { Router } from "express";

import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { requireCompanyContext, requireTenantContext } from "../../../core/api/tenant-context.middleware.js";
import { requireAuth } from "../../../security/api/auth.middleware.js";
import { requirePermission } from "../../../security/api/permission.middleware.js";
import { getRequestContext } from "../../../../utils/requestContext.js";
import { sendSuccess } from "../../../../utils/responseBuilder.js";
import { validateRequest } from "../../../../utils/validateRequest.js";
import { accountsReceivableDocumentService } from "../../application/AccountsReceivableDocumentService.js";
import { customerCreditNoteService } from "../../application/CustomerCreditNoteService.js";
import { customerReceiptService } from "../../application/CustomerReceiptService.js";
import {
  accountsReceivableDocumentCreateSchema,
  accountsReceivableDocumentIdParamsSchema,
  accountsReceivableDocumentListQuerySchema,
  customerBalanceListQuerySchema,
  customerBalanceParamsSchema
} from "../../validators/accounts-receivable-document.validators.js";
import {
  customerCreditNoteApplicationCreateSchema,
  customerCreditNoteCreateSchema,
  customerCreditNoteIdParamsSchema,
  customerCreditNoteListQuerySchema
} from "../../validators/customer-credit-note.validators.js";
import {
  customerReceiptApplicationCreateSchema,
  customerReceiptCreateSchema,
  customerReceiptIdParamsSchema,
  customerReceiptListQuerySchema
} from "../../validators/customer-receipt.validators.js";

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
  "/customer-credit-notes",
  validateRequest({ query: customerCreditNoteListQuerySchema }),
  requirePermission("receivables", "ar.customer-credit-notes.read"),
  asyncHandler(async (request, response) => {
    const result = await customerCreditNoteService.listCustomerCreditNotes(
      accountsReceivableContext(request),
      request.query
    );

    sendSuccess(response, result);
  })
);

accountsReceivableRouter.get(
  "/customer-credit-notes/:id",
  validateRequest({ params: customerCreditNoteIdParamsSchema }),
  requirePermission("receivables", "ar.customer-credit-notes.read"),
  asyncHandler(async (request, response) => {
    const result = await customerCreditNoteService.getCustomerCreditNote(
      accountsReceivableContext(request),
      request.params.id!
    );

    sendSuccess(response, result);
  })
);

accountsReceivableRouter.post(
  "/customer-credit-notes",
  validateRequest({ body: customerCreditNoteCreateSchema }),
  requirePermission("receivables", "ar.customer-credit-notes.create"),
  asyncHandler(async (request, response) => {
    const result = await customerCreditNoteService.createCustomerCreditNote(
      accountsReceivableContext(request),
      request.body
    );

    sendSuccess(response, result, 201);
  })
);

accountsReceivableRouter.post(
  "/customer-credit-notes/:id/applications",
  validateRequest({ params: customerCreditNoteIdParamsSchema, body: customerCreditNoteApplicationCreateSchema }),
  requirePermission("receivables", "ar.customer-credit-notes.update"),
  asyncHandler(async (request, response) => {
    const result = await customerCreditNoteService.addApplication(
      accountsReceivableContext(request),
      request.params.id!,
      request.body
    );

    sendSuccess(response, result);
  })
);

accountsReceivableRouter.post(
  "/customer-credit-notes/:id/post",
  validateRequest({ params: customerCreditNoteIdParamsSchema }),
  requirePermission("receivables", "ar.customer-credit-notes.post"),
  asyncHandler(async (request, response) => {
    const result = await customerCreditNoteService.postCustomerCreditNote(
      accountsReceivableContext(request),
      request.params.id!
    );

    sendSuccess(response, result);
  })
);

accountsReceivableRouter.get(
  "/receipts",
  validateRequest({ query: customerReceiptListQuerySchema }),
  requirePermission("receivables", "ar.receipts.read"),
  asyncHandler(async (request, response) => {
    const result = await customerReceiptService.listCustomerReceipts(accountsReceivableContext(request), request.query);

    sendSuccess(response, result);
  })
);

accountsReceivableRouter.get(
  "/receipts/:id",
  validateRequest({ params: customerReceiptIdParamsSchema }),
  requirePermission("receivables", "ar.receipts.read"),
  asyncHandler(async (request, response) => {
    const result = await customerReceiptService.getCustomerReceipt(
      accountsReceivableContext(request),
      request.params.id!
    );

    sendSuccess(response, result);
  })
);

accountsReceivableRouter.post(
  "/receipts",
  validateRequest({ body: customerReceiptCreateSchema }),
  requirePermission("receivables", "ar.receipts.create"),
  asyncHandler(async (request, response) => {
    const result = await customerReceiptService.createCustomerReceipt(accountsReceivableContext(request), request.body);

    sendSuccess(response, result, 201);
  })
);

accountsReceivableRouter.post(
  "/receipts/:id/applications",
  validateRequest({ params: customerReceiptIdParamsSchema, body: customerReceiptApplicationCreateSchema }),
  requirePermission("receivables", "ar.receipts.update"),
  asyncHandler(async (request, response) => {
    const result = await customerReceiptService.addApplication(
      accountsReceivableContext(request),
      request.params.id!,
      request.body
    );

    sendSuccess(response, result);
  })
);

accountsReceivableRouter.post(
  "/receipts/:id/post",
  validateRequest({ params: customerReceiptIdParamsSchema }),
  requirePermission("receivables", "ar.receipts.post"),
  asyncHandler(async (request, response) => {
    const result = await customerReceiptService.postCustomerReceipt(
      accountsReceivableContext(request),
      request.params.id!
    );

    sendSuccess(response, result);
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
