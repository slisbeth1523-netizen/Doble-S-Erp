import { Router } from "express";

import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { requireCompanyContext, requireTenantContext } from "../../../core/api/tenant-context.middleware.js";
import { requireAuth } from "../../../security/api/auth.middleware.js";
import { requirePermission } from "../../../security/api/permission.middleware.js";
import { getRequestContext } from "../../../../utils/requestContext.js";
import { sendSuccess } from "../../../../utils/responseBuilder.js";
import { validateRequest } from "../../../../utils/validateRequest.js";
import { purchaseOrderService } from "../../application/PurchaseOrderService.js";
import { purchaseReceiptService } from "../../application/PurchaseReceiptService.js";
import { supplierInvoiceService } from "../../application/SupplierInvoiceService.js";
import {
  purchaseOrderCancelSchema,
  purchaseOrderCreateSchema,
  purchaseOrderIdParamsSchema,
  purchaseOrderListQuerySchema
} from "../../validators/purchase-order.validators.js";
import {
  purchaseReceiptCreateSchema,
  purchaseReceiptIdParamsSchema,
  purchaseReceiptLineCreateSchema,
  purchaseReceiptListQuerySchema
} from "../../validators/purchase-receipt.validators.js";
import {
  supplierInvoiceCreateSchema,
  supplierInvoiceIdParamsSchema,
  supplierInvoiceLineCreateSchema,
  supplierInvoiceListQuerySchema
} from "../../validators/supplier-invoice.validators.js";

export const purchasingRouter = Router();

purchasingRouter.use(requireAuth, requireTenantContext, requireCompanyContext);

function purchasingContext(request: Parameters<typeof getRequestContext>[0]) {
  const context = getRequestContext(request);

  return {
    tenantId: request.tenantContext!.tenantId,
    companyId: request.tenantContext!.companyId!,
    userId: context.userId
  };
}

purchasingRouter.get(
  "/purchase-orders",
  validateRequest({ query: purchaseOrderListQuerySchema }),
  requirePermission("purchasing", "purchasing.purchase-orders.read"),
  asyncHandler(async (request, response) => {
    const result = await purchaseOrderService.listPurchaseOrders(
      purchasingContext(request),
      request.query
    );

    sendSuccess(response, result);
  })
);

purchasingRouter.get(
  "/purchase-orders/:id",
  validateRequest({ params: purchaseOrderIdParamsSchema }),
  requirePermission("purchasing", "purchasing.purchase-orders.read"),
  asyncHandler(async (request, response) => {
    const result = await purchaseOrderService.getPurchaseOrder(
      purchasingContext(request),
      request.params.id!
    );

    sendSuccess(response, result);
  })
);

purchasingRouter.post(
  "/purchase-orders",
  validateRequest({ body: purchaseOrderCreateSchema }),
  requirePermission("purchasing", "purchasing.purchase-orders.create"),
  asyncHandler(async (request, response) => {
    const result = await purchaseOrderService.createPurchaseOrder(
      purchasingContext(request),
      request.body
    );

    sendSuccess(response, result, 201);
  })
);

purchasingRouter.post(
  "/purchase-orders/:id/approve",
  validateRequest({ params: purchaseOrderIdParamsSchema }),
  requirePermission("purchasing", "purchasing.purchase-orders.approve"),
  asyncHandler(async (request, response) => {
    const result = await purchaseOrderService.approvePurchaseOrder(
      purchasingContext(request),
      request.params.id!
    );

    sendSuccess(response, result);
  })
);

purchasingRouter.post(
  "/purchase-orders/:id/cancel",
  validateRequest({ params: purchaseOrderIdParamsSchema, body: purchaseOrderCancelSchema }),
  requirePermission("purchasing", "purchasing.purchase-orders.cancel"),
  asyncHandler(async (request, response) => {
    const result = await purchaseOrderService.cancelPurchaseOrder(
      purchasingContext(request),
      request.params.id!,
      request.body
    );

    sendSuccess(response, result);
  })
);

purchasingRouter.get(
  "/purchase-receipts",
  validateRequest({ query: purchaseReceiptListQuerySchema }),
  requirePermission("purchasing", "purchasing.purchase-receipts.read"),
  asyncHandler(async (request, response) => {
    const result = await purchaseReceiptService.listPurchaseReceipts(
      purchasingContext(request),
      request.query
    );

    sendSuccess(response, result);
  })
);

purchasingRouter.get(
  "/purchase-receipts/:id",
  validateRequest({ params: purchaseReceiptIdParamsSchema }),
  requirePermission("purchasing", "purchasing.purchase-receipts.read"),
  asyncHandler(async (request, response) => {
    const result = await purchaseReceiptService.getPurchaseReceipt(
      purchasingContext(request),
      request.params.id!
    );

    sendSuccess(response, result);
  })
);

purchasingRouter.post(
  "/purchase-receipts",
  validateRequest({ body: purchaseReceiptCreateSchema }),
  requirePermission("purchasing", "purchasing.purchase-receipts.create"),
  asyncHandler(async (request, response) => {
    const result = await purchaseReceiptService.createPurchaseReceipt(
      purchasingContext(request),
      request.body
    );

    sendSuccess(response, result, 201);
  })
);

purchasingRouter.post(
  "/purchase-receipts/:id/lines",
  validateRequest({ params: purchaseReceiptIdParamsSchema, body: purchaseReceiptLineCreateSchema }),
  requirePermission("purchasing", "purchasing.purchase-receipts.create"),
  asyncHandler(async (request, response) => {
    const result = await purchaseReceiptService.addPurchaseReceiptLine(
      purchasingContext(request),
      request.params.id!,
      request.body
    );

    sendSuccess(response, result, 201);
  })
);

purchasingRouter.post(
  "/purchase-receipts/:id/complete",
  validateRequest({ params: purchaseReceiptIdParamsSchema }),
  requirePermission("purchasing", "purchasing.purchase-receipts.post"),
  asyncHandler(async (request, response) => {
    const result = await purchaseReceiptService.completePurchaseReceipt(
      purchasingContext(request),
      request.params.id!
    );

    sendSuccess(response, result);
  })
);

purchasingRouter.get(
  "/supplier-invoices",
  validateRequest({ query: supplierInvoiceListQuerySchema }),
  requirePermission("purchasing", "purchasing.supplier-invoices.read"),
  asyncHandler(async (request, response) => {
    const result = await supplierInvoiceService.listSupplierInvoices(
      purchasingContext(request),
      request.query
    );

    sendSuccess(response, result);
  })
);

purchasingRouter.get(
  "/supplier-invoices/:id",
  validateRequest({ params: supplierInvoiceIdParamsSchema }),
  requirePermission("purchasing", "purchasing.supplier-invoices.read"),
  asyncHandler(async (request, response) => {
    const result = await supplierInvoiceService.getSupplierInvoice(
      purchasingContext(request),
      request.params.id!
    );

    sendSuccess(response, result);
  })
);

purchasingRouter.post(
  "/supplier-invoices",
  validateRequest({ body: supplierInvoiceCreateSchema }),
  requirePermission("purchasing", "purchasing.supplier-invoices.create"),
  asyncHandler(async (request, response) => {
    const result = await supplierInvoiceService.createSupplierInvoice(
      purchasingContext(request),
      request.body
    );

    sendSuccess(response, result, 201);
  })
);

purchasingRouter.post(
  "/supplier-invoices/:id/lines",
  validateRequest({ params: supplierInvoiceIdParamsSchema, body: supplierInvoiceLineCreateSchema }),
  requirePermission("purchasing", "purchasing.supplier-invoices.create"),
  asyncHandler(async (request, response) => {
    const result = await supplierInvoiceService.addSupplierInvoiceLine(
      purchasingContext(request),
      request.params.id!,
      request.body
    );

    sendSuccess(response, result, 201);
  })
);

purchasingRouter.post(
  "/supplier-invoices/:id/complete",
  validateRequest({ params: supplierInvoiceIdParamsSchema }),
  requirePermission("purchasing", "purchasing.supplier-invoices.post"),
  asyncHandler(async (request, response) => {
    const result = await supplierInvoiceService.completeSupplierInvoice(
      purchasingContext(request),
      request.params.id!
    );

    sendSuccess(response, result);
  })
);
