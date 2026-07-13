import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const dateInputSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date");

export const customerReceiptIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const customerReceiptListQuerySchema = z.object({
  customerId: uniqueIdentifierSchema.optional(),
  status: z.enum(["DRAFT", "POSTED", "CANCELLED"]).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const customerReceiptCreateSchema = z.object({
  customerId: uniqueIdentifierSchema,
  receiptDate: dateInputSchema.optional(),
  totalAmount: z.number().positive(),
  reference: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable()
});

export const customerReceiptApplicationCreateSchema = z.object({
  accountsReceivableDocumentId: uniqueIdentifierSchema,
  appliedAmount: z.number().positive(),
  notes: z.string().trim().max(500).optional().nullable()
});

export type CustomerReceiptCreatePayload = z.infer<typeof customerReceiptCreateSchema>;
export type CustomerReceiptApplicationCreatePayload = z.infer<typeof customerReceiptApplicationCreateSchema>;
export type CustomerReceiptListQuery = z.infer<typeof customerReceiptListQuerySchema>;
