import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const idempotencyKeySchema = z.string().trim().min(8).max(120);

export const salesShipmentStatusSchema = z.enum(["DRAFT", "POSTED", "CANCELLED"]);

export const salesShipmentIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const salesShipmentLineIdParamsSchema = z.object({
  id: uniqueIdentifierSchema,
  lineId: uniqueIdentifierSchema
});

export const salesShipmentListQuerySchema = z.object({
  salesOrderId: uniqueIdentifierSchema.optional(),
  customerId: uniqueIdentifierSchema.optional(),
  status: salesShipmentStatusSchema.optional(),
  warehouseId: uniqueIdentifierSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const salesShipmentCreateSchema = z.object({
  salesOrderId: uniqueIdentifierSchema,
  shipmentDate: z.coerce.date().optional(),
  reference: optionalText(120),
  notes: optionalText(1000)
});

export const salesShipmentLineCreateSchema = z.object({
  salesOrderLineId: uniqueIdentifierSchema,
  inventoryReservationId: uniqueIdentifierSchema,
  quantity: z.number().positive(),
  notes: optionalText(500)
});

export const salesShipmentLineUpdateSchema = z.object({
  quantity: z.number().positive().optional(),
  notes: optionalText(500)
});

export const salesShipmentPostSchema = z.object({
  idempotencyKey: idempotencyKeySchema
});

export type SalesShipmentCreatePayload = z.infer<typeof salesShipmentCreateSchema>;
export type SalesShipmentLineCreatePayload = z.infer<typeof salesShipmentLineCreateSchema>;
export type SalesShipmentLineUpdatePayload = z.infer<typeof salesShipmentLineUpdateSchema>;
export type SalesShipmentListQuery = z.infer<typeof salesShipmentListQuerySchema>;
export type SalesShipmentPostPayload = z.infer<typeof salesShipmentPostSchema>;
