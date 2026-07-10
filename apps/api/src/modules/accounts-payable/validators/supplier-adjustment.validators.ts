import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

export const supplierAdjustmentIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const supplierAdjustmentListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["DRAFT", "POSTED", "CANCELLED"]).optional(),
  adjustmentType: z.enum(["CREDIT_NOTE", "DEBIT_NOTE"]).optional(),
  supplierId: uniqueIdentifierSchema.optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const supplierAdjustmentCreateSchema = z.object({
  supplierId: uniqueIdentifierSchema,
  adjustmentType: z.enum(["CREDIT_NOTE", "DEBIT_NOTE"]),
  adjustmentDate: z.string().datetime({ offset: true }).optional(),
  amount: z.number().positive(),
  reference: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable()
});

export const supplierAdjustmentApplicationCreateSchema = z.object({
  accountsPayableDocumentId: uniqueIdentifierSchema,
  appliedAmount: z.number().positive(),
  notes: z.string().trim().max(500).optional().nullable()
});

export type SupplierAdjustmentCreatePayload = z.infer<typeof supplierAdjustmentCreateSchema>;
export type SupplierAdjustmentApplicationCreatePayload = z.infer<typeof supplierAdjustmentApplicationCreateSchema>;
export type SupplierAdjustmentListQuery = z.infer<typeof supplierAdjustmentListQuerySchema>;
