import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const idempotencyKeySchema = z.string().trim().min(8).max(120);

export const salesInvoiceStatusSchema = z.enum(["DRAFT", "POSTED", "CANCELLED"]);

export const salesInvoiceIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const salesInvoiceLineIdParamsSchema = z.object({
  id: uniqueIdentifierSchema,
  lineId: uniqueIdentifierSchema
});

export const salesInvoiceOrderIdParamsSchema = z.object({
  orderId: uniqueIdentifierSchema
});

export const salesInvoiceShipmentIdParamsSchema = z.object({
  shipmentId: uniqueIdentifierSchema
});

export const salesInvoiceListQuerySchema = z.object({
  customerId: uniqueIdentifierSchema.optional(),
  salesOrderId: uniqueIdentifierSchema.optional(),
  salesShipmentId: uniqueIdentifierSchema.optional(),
  status: salesInvoiceStatusSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  dueDateFrom: z.coerce.date().optional(),
  dueDateTo: z.coerce.date().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const salesInvoiceCreateSchema = z.object({
  salesOrderId: uniqueIdentifierSchema,
  invoiceDate: z.coerce.date().optional(),
  dueDate: z.coerce.date(),
  reference: optionalText(120),
  notes: optionalText(1000)
});

export const salesInvoiceLineCreateSchema = z.object({
  salesShipmentLineId: uniqueIdentifierSchema,
  quantity: z.number().positive(),
  notes: optionalText(500)
});

export const salesInvoiceLineUpdateSchema = z.object({
  quantity: z.number().positive().optional(),
  notes: optionalText(500)
});

export const salesInvoicePostSchema = z.object({
  idempotencyKey: idempotencyKeySchema
});

export type SalesInvoiceCreatePayload = z.infer<typeof salesInvoiceCreateSchema>;
export type SalesInvoiceLineCreatePayload = z.infer<typeof salesInvoiceLineCreateSchema>;
export type SalesInvoiceLineUpdatePayload = z.infer<typeof salesInvoiceLineUpdateSchema>;
export type SalesInvoiceListQuery = z.infer<typeof salesInvoiceListQuerySchema>;
export type SalesInvoicePostPayload = z.infer<typeof salesInvoicePostSchema>;
