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
import { salesOrderService } from "../../application/SalesOrderService.js";
import { salesQuotationService } from "../../application/SalesQuotationService.js";
import { salesShipmentService } from "../../application/SalesShipmentService.js";
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
