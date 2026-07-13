import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const inventoryReservationStatusSchema = z.enum([
  "ACTIVE",
  "PARTIALLY_RELEASED",
  "RELEASED",
  "CONSUMED",
  "CANCELLED"
]);

export const inventoryReservationIdParamsSchema = z.object({
  reservationId: uniqueIdentifierSchema
});

export const inventoryAvailabilityItemParamsSchema = z.object({
  itemId: uniqueIdentifierSchema
});

export const salesOrderReservationParamsSchema = z.object({
  orderId: uniqueIdentifierSchema
});

export const salesOrderLineReserveParamsSchema = z.object({
  orderId: uniqueIdentifierSchema,
  lineId: uniqueIdentifierSchema
});

export const inventoryReservationListQuerySchema = z.object({
  orderId: uniqueIdentifierSchema.optional(),
  orderLineId: uniqueIdentifierSchema.optional(),
  itemId: uniqueIdentifierSchema.optional(),
  warehouseId: uniqueIdentifierSchema.optional(),
  status: inventoryReservationStatusSchema.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const inventoryAvailabilityListQuerySchema = z.object({
  itemId: uniqueIdentifierSchema.optional(),
  warehouseId: uniqueIdentifierSchema.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const inventoryReservationCreateSchema = z.object({
  quantity: z.number().positive(),
  reference: optionalText(120),
  notes: optionalText(500)
});

export const inventoryReservationReleaseSchema = z.object({
  quantity: z.number().positive(),
  reason: optionalText(500)
});

export type InventoryReservationCreatePayload = z.infer<typeof inventoryReservationCreateSchema>;
export type InventoryReservationReleasePayload = z.infer<typeof inventoryReservationReleaseSchema>;
export type InventoryReservationListQuery = z.infer<typeof inventoryReservationListQuerySchema>;
export type InventoryAvailabilityListQuery = z.infer<typeof inventoryAvailabilityListQuerySchema>;
