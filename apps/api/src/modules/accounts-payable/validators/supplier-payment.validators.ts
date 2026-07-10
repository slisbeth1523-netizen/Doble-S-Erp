import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

export const supplierPaymentIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const supplierPaymentListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["DRAFT", "POSTED", "CANCELLED"]).optional(),
  supplierId: uniqueIdentifierSchema.optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const supplierPaymentCreateSchema = z.object({
  supplierId: uniqueIdentifierSchema,
  paymentDate: z.string().datetime({ offset: true }).optional(),
  totalAmount: z.number().positive(),
  reference: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable()
});

export const supplierPaymentApplicationCreateSchema = z.object({
  accountsPayableDocumentId: uniqueIdentifierSchema,
  appliedAmount: z.number().positive(),
  notes: z.string().trim().max(500).optional().nullable()
});

export type SupplierPaymentCreatePayload = z.infer<typeof supplierPaymentCreateSchema>;
export type SupplierPaymentApplicationCreatePayload = z.infer<typeof supplierPaymentApplicationCreateSchema>;
export type SupplierPaymentListQuery = z.infer<typeof supplierPaymentListQuerySchema>;
