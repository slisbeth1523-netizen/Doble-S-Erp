import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const idempotencyKeySchema = z.string().trim().min(8).max(120);

export const salesReturnStatusSchema = z.enum(["DRAFT", "POSTED", "CANCELLED"]);

export const salesReturnIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const salesReturnLineIdParamsSchema = z.object({
  id: uniqueIdentifierSchema,
  lineId: uniqueIdentifierSchema
});

export const salesReturnShipmentIdParamsSchema = z.object({
  shipmentId: uniqueIdentifierSchema
});

export const salesReturnInvoiceIdParamsSchema = z.object({
  invoiceId: uniqueIdentifierSchema
});

export const salesReturnListQuerySchema = z.object({
  customerId: uniqueIdentifierSchema.optional(),
  salesOrderId: uniqueIdentifierSchema.optional(),
  salesShipmentId: uniqueIdentifierSchema.optional(),
  salesInvoiceId: uniqueIdentifierSchema.optional(),
  status: salesReturnStatusSchema.optional(),
  warehouseId: uniqueIdentifierSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const salesReturnCreateSchema = z.object({
  salesShipmentId: uniqueIdentifierSchema,
  salesInvoiceId: uniqueIdentifierSchema.optional().nullable(),
  returnDate: z.coerce.date().optional(),
  reason: optionalText(500),
  reference: optionalText(120),
  notes: optionalText(1000)
});

export const salesReturnLineCreateSchema = z.object({
  salesShipmentLineId: uniqueIdentifierSchema,
  salesInvoiceLineId: uniqueIdentifierSchema.optional().nullable(),
  quantity: z.number().positive(),
  reason: optionalText(500),
  notes: optionalText(500)
});

export const salesReturnLineUpdateSchema = z.object({
  quantity: z.number().positive().optional(),
  reason: optionalText(500),
  notes: optionalText(500)
});

export const salesReturnPostSchema = z.object({
  idempotencyKey: idempotencyKeySchema
});

export type SalesReturnCreatePayload = z.infer<typeof salesReturnCreateSchema>;
export type SalesReturnLineCreatePayload = z.infer<typeof salesReturnLineCreateSchema>;
export type SalesReturnLineUpdatePayload = z.infer<typeof salesReturnLineUpdateSchema>;
export type SalesReturnListQuery = z.infer<typeof salesReturnListQuerySchema>;
export type SalesReturnPostPayload = z.infer<typeof salesReturnPostSchema>;
