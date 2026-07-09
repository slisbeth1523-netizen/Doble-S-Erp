import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

export const purchaseOrderIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const purchaseOrderListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["DRAFT", "APPROVED", "CANCELLED", "CLOSED"]).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

const purchaseOrderLineSchema = z.object({
  itemId: uniqueIdentifierSchema,
  warehouseId: uniqueIdentifierSchema,
  unitOfMeasureId: uniqueIdentifierSchema.optional().nullable(),
  quantity: z.number().positive(),
  unitCost: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  taxAmount: z.number().min(0).optional(),
  expectedDate: z.string().date().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable()
});

export const purchaseOrderCreateSchema = z.object({
  supplierId: uniqueIdentifierSchema,
  orderDate: z.string().datetime({ offset: true }).optional(),
  expectedDate: z.string().date().optional().nullable(),
  reference: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  lines: z.array(purchaseOrderLineSchema).min(1)
});

export const purchaseOrderCancelSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable()
});

export type PurchaseOrderCreatePayload = z.infer<typeof purchaseOrderCreateSchema>;
export type PurchaseOrderListQuery = z.infer<typeof purchaseOrderListQuerySchema>;
export type PurchaseOrderCancelPayload = z.infer<typeof purchaseOrderCancelSchema>;
