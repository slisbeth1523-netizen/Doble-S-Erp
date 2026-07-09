import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

export const purchaseReceiptIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const purchaseReceiptListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["DRAFT", "POSTED"]).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const purchaseReceiptCreateSchema = z.object({
  purchaseOrderId: uniqueIdentifierSchema,
  receiptDate: z.string().datetime({ offset: true }).optional(),
  reference: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable()
});

export const purchaseReceiptLineCreateSchema = z.object({
  purchaseOrderLineId: uniqueIdentifierSchema,
  quantityReceived: z.number().positive(),
  unitCost: z.number().min(0).optional(),
  lotNumber: z.string().trim().max(100).optional().nullable(),
  serialNumber: z.string().trim().max(100).optional().nullable(),
  expirationDate: z.string().date().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable()
});

export type PurchaseReceiptCreatePayload = z.infer<typeof purchaseReceiptCreateSchema>;
export type PurchaseReceiptLineCreatePayload = z.infer<typeof purchaseReceiptLineCreateSchema>;
export type PurchaseReceiptListQuery = z.infer<typeof purchaseReceiptListQuerySchema>;
