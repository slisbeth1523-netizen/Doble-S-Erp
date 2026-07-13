import { Router } from "express";

import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { requireCompanyContext, requireTenantContext } from "../../../core/api/tenant-context.middleware.js";
import { requireAuth } from "../../../security/api/auth.middleware.js";
import { requirePermission } from "../../../security/api/permission.middleware.js";
import { getRequestContext } from "../../../../utils/requestContext.js";
import { sendSuccess } from "../../../../utils/responseBuilder.js";
import { validateRequest } from "../../../../utils/validateRequest.js";
import { inventoryAdjustmentService } from "../../application/InventoryAdjustmentService.js";
import { inventoryPostingService } from "../../application/InventoryPostingService.js";
import { inventoryReservationService } from "../../application/InventoryReservationService.js";
import { physicalCountService } from "../../application/PhysicalCountService.js";
import { inventoryAdjustmentCreateSchema } from "../../validators/inventory-adjustment.validators.js";
import { inventoryMovementIdParamsSchema } from "../../validators/inventory.validators.js";
import {
  inventoryAvailabilityItemParamsSchema,
  inventoryAvailabilityListQuerySchema,
  inventoryReservationIdParamsSchema,
  inventoryReservationListQuerySchema,
  inventoryReservationReleaseSchema
} from "../../validators/inventory-reservation.validators.js";
import {
  physicalCountCreateSchema,
  physicalCountIdParamsSchema,
  physicalCountLineCreateSchema
} from "../../validators/physical-count.validators.js";

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth, requireTenantContext, requireCompanyContext);

function inventoryContext(request: Parameters<typeof getRequestContext>[0]) {
  const context = getRequestContext(request);

  return {
    tenantId: request.tenantContext!.tenantId,
    companyId: request.tenantContext!.companyId!,
    userId: context.userId,
    requestId: context.requestId,
    correlationId: context.correlationId
  };
}

inventoryRouter.get(
  "/availability",
  validateRequest({ query: inventoryAvailabilityListQuerySchema }),
  requirePermission("inventory", "inventory.availability.read"),
  asyncHandler(async (request, response) => {
    const result = await inventoryReservationService.listAvailability(inventoryContext(request), request.query);

    sendSuccess(response, result);
  })
);

inventoryRouter.get(
  "/availability/:itemId",
  validateRequest({ params: inventoryAvailabilityItemParamsSchema }),
  requirePermission("inventory", "inventory.availability.read"),
  asyncHandler(async (request, response) => {
    const result = await inventoryReservationService.getAvailabilityByItem(
      inventoryContext(request),
      request.params.itemId!
    );

    sendSuccess(response, result);
  })
);

inventoryRouter.get(
  "/reservations",
  validateRequest({ query: inventoryReservationListQuerySchema }),
  requirePermission("inventory", "inventory.reservations.read"),
  asyncHandler(async (request, response) => {
    const result = await inventoryReservationService.listReservations(inventoryContext(request), request.query);

    sendSuccess(response, result);
  })
);

inventoryRouter.post(
  "/reservations/:reservationId/release",
  validateRequest({ params: inventoryReservationIdParamsSchema, body: inventoryReservationReleaseSchema }),
  requirePermission("inventory", "inventory.reservations.release"),
  asyncHandler(async (request, response) => {
    const result = await inventoryReservationService.releaseReservation(
      inventoryContext(request),
      request.params.reservationId!,
      request.body
    );

    sendSuccess(response, result);
  })
);

inventoryRouter.post(
  "/adjustments",
  validateRequest({ body: inventoryAdjustmentCreateSchema }),
  requirePermission("inventory", "inventory.adjustments.create"),
  asyncHandler(async (request, response) => {
    const context = getRequestContext(request);
    const result = await inventoryAdjustmentService.createAdjustment(
      {
        tenantId: request.tenantContext!.tenantId,
        companyId: request.tenantContext!.companyId!,
        userId: context.userId
      },
      request.body
    );

    sendSuccess(response, result, 201);
  })
);

inventoryRouter.post(
  "/physical-counts",
  validateRequest({ body: physicalCountCreateSchema }),
  requirePermission("inventory", "inventory.physical-counts.create"),
  asyncHandler(async (request, response) => {
    const context = getRequestContext(request);
    const result = await physicalCountService.createPhysicalCount(
      {
        tenantId: request.tenantContext!.tenantId,
        companyId: request.tenantContext!.companyId!,
        userId: context.userId
      },
      request.body
    );

    sendSuccess(response, result, 201);
  })
);

inventoryRouter.post(
  "/physical-counts/:id/lines",
  validateRequest({ params: physicalCountIdParamsSchema, body: physicalCountLineCreateSchema }),
  requirePermission("inventory", "inventory.physical-counts.count"),
  asyncHandler(async (request, response) => {
    const context = getRequestContext(request);
    const result = await physicalCountService.addPhysicalCountLine(
      {
        tenantId: request.tenantContext!.tenantId,
        companyId: request.tenantContext!.companyId!,
        userId: context.userId
      },
      request.params.id!,
      request.body
    );

    sendSuccess(response, result, 201);
  })
);

inventoryRouter.post(
  "/physical-counts/:id/complete",
  validateRequest({ params: physicalCountIdParamsSchema }),
  requirePermission("inventory", "inventory.physical-counts.complete"),
  asyncHandler(async (request, response) => {
    const context = getRequestContext(request);
    const result = await physicalCountService.completePhysicalCount(
      {
        tenantId: request.tenantContext!.tenantId,
        companyId: request.tenantContext!.companyId!,
        userId: context.userId
      },
      request.params.id!
    );

    sendSuccess(response, result);
  })
);

inventoryRouter.post(
  "/physical-counts/:id/create-adjustment",
  validateRequest({ params: physicalCountIdParamsSchema }),
  requirePermission("inventory", "inventory.physical-counts.adjust"),
  asyncHandler(async (request, response) => {
    const context = getRequestContext(request);
    const result = await physicalCountService.createAdjustmentFromPhysicalCount(
      {
        tenantId: request.tenantContext!.tenantId,
        companyId: request.tenantContext!.companyId!,
        userId: context.userId
      },
      request.params.id!
    );

    sendSuccess(response, result, 201);
  })
);

inventoryRouter.post(
  "/movements/:id/post",
  validateRequest({ params: inventoryMovementIdParamsSchema }),
  requirePermission("inventory", "inventory.movements.post"),
  asyncHandler(async (request, response) => {
    const context = getRequestContext(request);
    const result = await inventoryPostingService.postMovement(
      {
        tenantId: request.tenantContext!.tenantId,
        companyId: request.tenantContext!.companyId!,
        userId: context.userId,
        requestId: context.requestId,
        correlationId: context.correlationId
      },
      request.params.id!
    );

    sendSuccess(response, result);
  })
);
