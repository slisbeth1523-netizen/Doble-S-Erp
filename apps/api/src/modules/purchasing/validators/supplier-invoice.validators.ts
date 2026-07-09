import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

export const supplierInvoiceIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const supplierInvoiceListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["DRAFT", "POSTED"]).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const supplierInvoiceCreateSchema = z.object({
  purchaseReceiptId: uniqueIdentifierSchema,
  supplierInvoiceNumber: z.string().trim().min(1).max(40),
  invoiceDate: z.string().datetime({ offset: true }).optional(),
  dueDate: z.string().datetime({ offset: true }).optional(),
  reference: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable()
});

export const supplierInvoiceLineCreateSchema = z.object({
  itemId: uniqueIdentifierSchema,
  unitOfMeasureId: uniqueIdentifierSchema.optional().nullable(),
  quantity: z.number().positive(),
  unitCost: z.number().min(0),
  taxAmount: z.number().min(0).optional(),
  notes: z.string().trim().max(500).optional().nullable()
});

export type SupplierInvoiceCreatePayload = z.infer<typeof supplierInvoiceCreateSchema>;
export type SupplierInvoiceLineCreatePayload = z.infer<typeof supplierInvoiceLineCreateSchema>;
export type SupplierInvoiceListQuery = z.infer<typeof supplierInvoiceListQuerySchema>;
