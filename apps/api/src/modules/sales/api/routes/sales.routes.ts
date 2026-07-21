import { Router } from "express";

import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { requireCompanyContext, requireTenantContext } from "../../../core/api/tenant-context.middleware.js";
import { requireAuth } from "../../../security/api/auth.middleware.js";
import { requirePermission } from "../../../security/api/permission.middleware.js";
import { getRequestContext } from "../../../../utils/requestContext.js";
import { sendSuccess } from "../../../../utils/responseBuilder.js";
import { validateRequest } from "../../../../utils/validateRequest.js";
import { inventoryReservationService } from "../../../inventory/application/InventoryReservationService.js";
import { inventoryReservationCreateSchema } from "../../../inventory/validators/inventory-reservation.validators.js";
import { salesAccountingService } from "../../application/SalesAccountingService.js";
import { salesInvoiceService } from "../../application/SalesInvoiceService.js";
import { salesOrderService } from "../../application/SalesOrderService.js";
import { salesQuotationService } from "../../application/SalesQuotationService.js";
import { salesReturnService } from "../../application/SalesReturnService.js";
import { salesShipmentService } from "../../application/SalesShipmentService.js";
import {
  salesAccountingDocumentParamsSchema,
  salesAccountingPayloadSchema
} from "../../validators/sales-accounting.validators.js";
import {
  salesInvoiceCreateSchema,
  salesInvoiceIdParamsSchema,
  salesInvoiceLineCreateSchema,
  salesInvoiceLineIdParamsSchema,
  salesInvoiceLineUpdateSchema,
  salesInvoiceListQuerySchema,
  salesInvoiceOrderIdParamsSchema,
  salesInvoicePostSchema,
  salesInvoiceShipmentIdParamsSchema
} from "../../validators/sales-invoice.validators.js";
import {
  salesOrderCancelSchema,
  salesOrderCreateSchema,
  salesOrderIdParamsSchema,
  salesOrderLineReserveParamsSchema,
  salesOrderLineCreateSchema,
  salesOrderLineIdParamsSchema,
  salesOrderLineUpdateSchema,
  salesOrderListQuerySchema,
  salesOrderQuotationIdParamsSchema,
  salesOrderReservationParamsSchema,
  salesOrderUpdateSchema
} from "../../validators/sales-order.validators.js";
import {
  salesQuotationCreateSchema,
  salesQuotationIdParamsSchema,
  salesQuotationLineCreateSchema,
  salesQuotationLineIdParamsSchema,
  salesQuotationLineUpdateSchema,
  salesQuotationListQuerySchema,
  salesQuotationUpdateSchema
} from "../../validators/sales-quotation.validators.js";
import {
  salesReturnCreateSchema,
  salesReturnIdParamsSchema,
  salesReturnInvoiceIdParamsSchema,
  salesReturnLineCreateSchema,
  salesReturnLineIdParamsSchema,
  salesReturnLineUpdateSchema,
  salesReturnListQuerySchema,
  salesReturnPostSchema,
  salesReturnShipmentIdParamsSchema
} from "../../validators/sales-return.validators.js";
import {
  salesShipmentCreateSchema,
  salesShipmentIdParamsSchema,
  salesShipmentLineCreateSchema,
  salesShipmentLineIdParamsSchema,
  salesShipmentLineUpdateSchema,
  salesShipmentListQuerySchema,
  salesShipmentPostSchema
} from "../../validators/sales-shipment.validators.js";

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
  "/returns",
  validateRequest({ query: salesReturnListQuerySchema }),
  requirePermission("sales", "sales.returns.read"),
  asyncHandler(async (request, response) => {
    const result = await salesReturnService.listReturns(salesContext(request), request.query);

    sendSuccess(response, result);
  })
);

salesRouter.get(
  "/returns/:id",
  validateRequest({ params: salesReturnIdParamsSchema }),
  requirePermission("sales", "sales.returns.read"),
  asyncHandler(async (request, response) => {
    const result = await salesReturnService.getReturn(salesContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

salesRouter.get(
  "/shipments/:shipmentId/returnable-lines",
  validateRequest({ params: salesReturnShipmentIdParamsSchema }),
  requirePermission("sales", "sales.returns.read"),
  asyncHandler(async (request, response) => {
    const result = await salesReturnService.listShipmentReturnableLines(salesContext(request), request.params.shipmentId!);

    sendSuccess(response, result);
  })
);

salesRouter.get(
  "/invoices/:invoiceId/returnable-lines",
  validateRequest({ params: salesReturnInvoiceIdParamsSchema }),
  requirePermission("sales", "sales.returns.read"),
  asyncHandler(async (request, response) => {
    const result = await salesReturnService.listInvoiceReturnableLines(salesContext(request), request.params.invoiceId!);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/returns",
  validateRequest({ body: salesReturnCreateSchema }),
  requirePermission("sales", "sales.returns.create"),
  asyncHandler(async (request, response) => {
    const result = await salesReturnService.createReturn(salesContext(request), request.body);

    sendSuccess(response, result, 201);
  })
);

salesRouter.post(
  "/returns/:id/lines",
  validateRequest({ params: salesReturnIdParamsSchema, body: salesReturnLineCreateSchema }),
  requirePermission("sales", "sales.returns.update"),
  asyncHandler(async (request, response) => {
    const result = await salesReturnService.addLine(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result, 201);
  })
);

salesRouter.patch(
  "/returns/:id/lines/:lineId",
  validateRequest({ params: salesReturnLineIdParamsSchema, body: salesReturnLineUpdateSchema }),
  requirePermission("sales", "sales.returns.update"),
  asyncHandler(async (request, response) => {
    const result = await salesReturnService.updateLine(
      salesContext(request),
      request.params.id!,
      request.params.lineId!,
      request.body
    );

    sendSuccess(response, result);
  })
);

salesRouter.delete(
  "/returns/:id/lines/:lineId",
  validateRequest({ params: salesReturnLineIdParamsSchema }),
  requirePermission("sales", "sales.returns.update"),
  asyncHandler(async (request, response) => {
    const result = await salesReturnService.deleteLine(salesContext(request), request.params.id!, request.params.lineId!);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/returns/:id/post",
  validateRequest({ params: salesReturnIdParamsSchema, body: salesReturnPostSchema }),
  requirePermission("sales", "sales.returns.post"),
  asyncHandler(async (request, response) => {
    const result = await salesReturnService.postReturn(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

salesRouter.get(
  "/invoices",
  validateRequest({ query: salesInvoiceListQuerySchema }),
  requirePermission("sales", "sales.invoices.read"),
  asyncHandler(async (request, response) => {
    const result = await salesInvoiceService.listInvoices(salesContext(request), request.query);

    sendSuccess(response, result);
  })
);

salesRouter.get(
  "/invoices/:id",
  validateRequest({ params: salesInvoiceIdParamsSchema }),
  requirePermission("sales", "sales.invoices.read"),
  asyncHandler(async (request, response) => {
    const result = await salesInvoiceService.getInvoice(salesContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

salesRouter.get(
  "/orders/:orderId/invoice-pending-lines",
  validateRequest({ params: salesInvoiceOrderIdParamsSchema }),
  requirePermission("sales", "sales.invoices.read"),
  asyncHandler(async (request, response) => {
    const result = await salesInvoiceService.getOrderPendingLines(salesContext(request), request.params.orderId!);

    sendSuccess(response, result);
  })
);

salesRouter.get(
  "/shipments/:shipmentId/invoice-pending-lines",
  validateRequest({ params: salesInvoiceShipmentIdParamsSchema }),
  requirePermission("sales", "sales.invoices.read"),
  asyncHandler(async (request, response) => {
    const result = await salesInvoiceService.getShipmentPendingLines(salesContext(request), request.params.shipmentId!);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/invoices",
  validateRequest({ body: salesInvoiceCreateSchema }),
  requirePermission("sales", "sales.invoices.create"),
  asyncHandler(async (request, response) => {
    const result = await salesInvoiceService.createInvoice(salesContext(request), request.body);

    sendSuccess(response, result, 201);
  })
);

salesRouter.post(
  "/invoices/:id/lines",
  validateRequest({ params: salesInvoiceIdParamsSchema, body: salesInvoiceLineCreateSchema }),
  requirePermission("sales", "sales.invoices.update"),
  asyncHandler(async (request, response) => {
    const result = await salesInvoiceService.addLine(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result, 201);
  })
);

salesRouter.patch(
  "/invoices/:id/lines/:lineId",
  validateRequest({ params: salesInvoiceLineIdParamsSchema, body: salesInvoiceLineUpdateSchema }),
  requirePermission("sales", "sales.invoices.update"),
  asyncHandler(async (request, response) => {
    const result = await salesInvoiceService.updateLine(
      salesContext(request),
      request.params.id!,
      request.params.lineId!,
      request.body
    );

    sendSuccess(response, result);
  })
);

salesRouter.delete(
  "/invoices/:id/lines/:lineId",
  validateRequest({ params: salesInvoiceLineIdParamsSchema }),
  requirePermission("sales", "sales.invoices.update"),
  asyncHandler(async (request, response) => {
    const result = await salesInvoiceService.deleteLine(salesContext(request), request.params.id!, request.params.lineId!);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/invoices/:id/post",
  validateRequest({ params: salesInvoiceIdParamsSchema, body: salesInvoicePostSchema }),
  requirePermission("sales", "sales.invoices.post"),
  asyncHandler(async (request, response) => {
    const result = await salesInvoiceService.postInvoice(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

salesRouter.get(
  "/invoices/:id/accounting",
  validateRequest({ params: salesAccountingDocumentParamsSchema }),
  requirePermission("sales", "sales.accounting.read"),
  asyncHandler(async (request, response) => {
    const result = await salesAccountingService.getInvoiceAccounting(salesContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/invoices/:id/accounting/preview",
  validateRequest({ params: salesAccountingDocumentParamsSchema, body: salesAccountingPayloadSchema }),
  requirePermission("sales", "sales.accounting.preview"),
  asyncHandler(async (request, response) => {
    const result = await salesAccountingService.previewInvoice(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/invoices/:id/accounting/post",
  validateRequest({ params: salesAccountingDocumentParamsSchema, body: salesAccountingPayloadSchema }),
  requirePermission("sales", "sales.accounting.post"),
  asyncHandler(async (request, response) => {
    const result = await salesAccountingService.postInvoiceAccounting(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/invoices/:id/accounting/reverse",
  validateRequest({ params: salesAccountingDocumentParamsSchema, body: salesAccountingPayloadSchema }),
  requirePermission("sales", "sales.accounting.reverse"),
  asyncHandler(async (request, response) => {
    const result = await salesAccountingService.reverseInvoiceAccounting(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/invoices/:id/accounting/repost",
  validateRequest({ params: salesAccountingDocumentParamsSchema, body: salesAccountingPayloadSchema }),
  requirePermission("sales", "sales.accounting.repost"),
  asyncHandler(async (request, response) => {
    const result = await salesAccountingService.repostInvoiceAccounting(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/customer-credit-notes/:id/accounting/preview",
  validateRequest({ params: salesAccountingDocumentParamsSchema, body: salesAccountingPayloadSchema }),
  requirePermission("sales", "sales.accounting.preview"),
  asyncHandler(async (request, response) => {
    const result = await salesAccountingService.previewCustomerCreditNote(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/customer-credit-notes/:id/accounting/post",
  validateRequest({ params: salesAccountingDocumentParamsSchema, body: salesAccountingPayloadSchema }),
  requirePermission("sales", "sales.accounting.post"),
  asyncHandler(async (request, response) => {
    const result = await salesAccountingService.postCustomerCreditNote(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/customer-credit-notes/:id/accounting/reverse",
  validateRequest({ params: salesAccountingDocumentParamsSchema, body: salesAccountingPayloadSchema }),
  requirePermission("sales", "sales.accounting.reverse"),
  asyncHandler(async (request, response) => {
    const result = await salesAccountingService.reverseCustomerCreditNote(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/customer-credit-notes/:id/accounting/repost",
  validateRequest({ params: salesAccountingDocumentParamsSchema, body: salesAccountingPayloadSchema }),
  requirePermission("sales", "sales.accounting.repost"),
  asyncHandler(async (request, response) => {
    const result = await salesAccountingService.repostCustomerCreditNote(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/customer-debit-notes/:id/accounting/preview",
  validateRequest({ params: salesAccountingDocumentParamsSchema, body: salesAccountingPayloadSchema }),
  requirePermission("sales", "sales.accounting.preview"),
  asyncHandler(async (request, response) => {
    const result = await salesAccountingService.previewCustomerDebitNote(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/customer-debit-notes/:id/accounting/post",
  validateRequest({ params: salesAccountingDocumentParamsSchema, body: salesAccountingPayloadSchema }),
  requirePermission("sales", "sales.accounting.post"),
  asyncHandler(async (request, response) => {
    const result = await salesAccountingService.postCustomerDebitNote(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/customer-debit-notes/:id/accounting/reverse",
  validateRequest({ params: salesAccountingDocumentParamsSchema, body: salesAccountingPayloadSchema }),
  requirePermission("sales", "sales.accounting.reverse"),
  asyncHandler(async (request, response) => {
    const result = await salesAccountingService.reverseCustomerDebitNote(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/customer-debit-notes/:id/accounting/repost",
  validateRequest({ params: salesAccountingDocumentParamsSchema, body: salesAccountingPayloadSchema }),
  requirePermission("sales", "sales.accounting.repost"),
  asyncHandler(async (request, response) => {
    const result = await salesAccountingService.repostCustomerDebitNote(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

salesRouter.get(
  "/orders/:orderId/reservations",
  validateRequest({ params: salesOrderReservationParamsSchema }),
  requirePermission("inventory", "inventory.reservations.read"),
  asyncHandler(async (request, response) => {
    const result = await inventoryReservationService.getSalesOrderReservations(
      salesContext(request),
      request.params.orderId!
    );

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/orders/:orderId/lines/:lineId/reserve",
  validateRequest({ params: salesOrderLineReserveParamsSchema, body: inventoryReservationCreateSchema }),
  requirePermission("inventory", "inventory.reservations.create"),
  asyncHandler(async (request, response) => {
    const result = await inventoryReservationService.reserveSalesOrderLine(
      salesContext(request),
      request.params.orderId!,
      request.params.lineId!,
      request.body
    );

    sendSuccess(response, result, 201);
  })
);

salesRouter.get(
  "/shipments",
  validateRequest({ query: salesShipmentListQuerySchema }),
  requirePermission("sales", "sales.shipments.read"),
  asyncHandler(async (request, response) => {
    const result = await salesShipmentService.listShipments(salesContext(request), request.query);

    sendSuccess(response, result);
  })
);

salesRouter.get(
  "/shipments/orders/:id/lines",
  validateRequest({ params: salesShipmentIdParamsSchema }),
  requirePermission("sales", "sales.shipments.read"),
  asyncHandler(async (request, response) => {
    const result = await salesShipmentService.getOrderShipmentLines(salesContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

salesRouter.get(
  "/shipments/:id",
  validateRequest({ params: salesShipmentIdParamsSchema }),
  requirePermission("sales", "sales.shipments.read"),
  asyncHandler(async (request, response) => {
    const result = await salesShipmentService.getShipment(salesContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/shipments",
  validateRequest({ body: salesShipmentCreateSchema }),
  requirePermission("sales", "sales.shipments.create"),
  asyncHandler(async (request, response) => {
    const result = await salesShipmentService.createShipment(salesContext(request), request.body);

    sendSuccess(response, result, 201);
  })
);

salesRouter.post(
  "/shipments/:id/lines",
  validateRequest({ params: salesShipmentIdParamsSchema, body: salesShipmentLineCreateSchema }),
  requirePermission("sales", "sales.shipments.update"),
  asyncHandler(async (request, response) => {
    const result = await salesShipmentService.addLine(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result, 201);
  })
);

salesRouter.patch(
  "/shipments/:id/lines/:lineId",
  validateRequest({ params: salesShipmentLineIdParamsSchema, body: salesShipmentLineUpdateSchema }),
  requirePermission("sales", "sales.shipments.update"),
  asyncHandler(async (request, response) => {
    const result = await salesShipmentService.updateLine(
      salesContext(request),
      request.params.id!,
      request.params.lineId!,
      request.body
    );

    sendSuccess(response, result);
  })
);

salesRouter.delete(
  "/shipments/:id/lines/:lineId",
  validateRequest({ params: salesShipmentLineIdParamsSchema }),
  requirePermission("sales", "sales.shipments.update"),
  asyncHandler(async (request, response) => {
    const result = await salesShipmentService.deleteLine(salesContext(request), request.params.id!, request.params.lineId!);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/shipments/:id/post",
  validateRequest({ params: salesShipmentIdParamsSchema, body: salesShipmentPostSchema }),
  requirePermission("sales", "sales.shipments.post"),
  asyncHandler(async (request, response) => {
    const result = await salesShipmentService.postShipment(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

salesRouter.get(
  "/orders",
  validateRequest({ query: salesOrderListQuerySchema }),
  requirePermission("sales", "sales.orders.read"),
  asyncHandler(async (request, response) => {
    const result = await salesOrderService.listOrders(salesContext(request), request.query);

    sendSuccess(response, result);
  })
);

salesRouter.get(
  "/orders/:id",
  validateRequest({ params: salesOrderIdParamsSchema }),
  requirePermission("sales", "sales.orders.read"),
  asyncHandler(async (request, response) => {
    const result = await salesOrderService.getOrder(salesContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/orders",
  validateRequest({ body: salesOrderCreateSchema }),
  requirePermission("sales", "sales.orders.create"),
  asyncHandler(async (request, response) => {
    const result = await salesOrderService.createOrder(salesContext(request), request.body);

    sendSuccess(response, result, 201);
  })
);

salesRouter.post(
  "/orders/from-quotation/:quotationId",
  validateRequest({ params: salesOrderQuotationIdParamsSchema }),
  requirePermission("sales", "sales.orders.create"),
  asyncHandler(async (request, response) => {
    const result = await salesOrderService.createFromQuotation(salesContext(request), request.params.quotationId!);

    sendSuccess(response, result, 201);
  })
);

salesRouter.patch(
  "/orders/:id",
  validateRequest({ params: salesOrderIdParamsSchema, body: salesOrderUpdateSchema }),
  requirePermission("sales", "sales.orders.update"),
  asyncHandler(async (request, response) => {
    const result = await salesOrderService.updateOrder(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/orders/:id/lines",
  validateRequest({ params: salesOrderIdParamsSchema, body: salesOrderLineCreateSchema }),
  requirePermission("sales", "sales.orders.update"),
  asyncHandler(async (request, response) => {
    const result = await salesOrderService.addLine(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result, 201);
  })
);

salesRouter.patch(
  "/orders/:id/lines/:lineId",
  validateRequest({ params: salesOrderLineIdParamsSchema, body: salesOrderLineUpdateSchema }),
  requirePermission("sales", "sales.orders.update"),
  asyncHandler(async (request, response) => {
    const result = await salesOrderService.updateLine(
      salesContext(request),
      request.params.id!,
      request.params.lineId!,
      request.body
    );

    sendSuccess(response, result);
  })
);

salesRouter.delete(
  "/orders/:id/lines/:lineId",
  validateRequest({ params: salesOrderLineIdParamsSchema }),
  requirePermission("sales", "sales.orders.update"),
  asyncHandler(async (request, response) => {
    const result = await salesOrderService.deleteLine(
      salesContext(request),
      request.params.id!,
      request.params.lineId!
    );

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/orders/:id/submit",
  validateRequest({ params: salesOrderIdParamsSchema }),
  requirePermission("sales", "sales.orders.submit"),
  asyncHandler(async (request, response) => {
    const result = await salesOrderService.submitOrder(salesContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/orders/:id/approve",
  validateRequest({ params: salesOrderIdParamsSchema }),
  requirePermission("sales", "sales.orders.approve"),
  asyncHandler(async (request, response) => {
    const result = await salesOrderService.approveOrder(salesContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/orders/:id/reject",
  validateRequest({ params: salesOrderIdParamsSchema }),
  requirePermission("sales", "sales.orders.reject"),
  asyncHandler(async (request, response) => {
    const result = await salesOrderService.rejectOrder(salesContext(request), request.params.id!);

    sendSuccess(response, result);
  })
);

salesRouter.post(
  "/orders/:id/cancel",
  validateRequest({ params: salesOrderIdParamsSchema, body: salesOrderCancelSchema }),
  requirePermission("sales", "sales.orders.cancel"),
  asyncHandler(async (request, response) => {
    const result = await salesOrderService.cancelOrder(salesContext(request), request.params.id!, request.body);

    sendSuccess(response, result);
  })
);

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
