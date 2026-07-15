import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const idempotencyKeySchema = z.string().trim().min(8).max(120);

export const salesCreditNoteStatusSchema = z.enum(["DRAFT", "POSTED", "CANCELLED"]);

export const salesCreditNoteIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const salesCreditNoteCreditableReturnListQuerySchema = z.object({
  customerId: uniqueIdentifierSchema.optional(),
  salesInvoiceId: uniqueIdentifierSchema.optional(),
  salesReturnId: uniqueIdentifierSchema.optional(),
  status: salesCreditNoteStatusSchema.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const salesCreditNoteListQuerySchema = z.object({
  customerId: uniqueIdentifierSchema.optional(),
  salesInvoiceId: uniqueIdentifierSchema.optional(),
  salesReturnId: uniqueIdentifierSchema.optional(),
  status: salesCreditNoteStatusSchema.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const salesCreditNoteCreateFromReturnSchema = z.object({
  salesReturnId: uniqueIdentifierSchema,
  amount: z.number().positive().optional(),
  creditNoteDate: z.coerce.date().optional(),
  reference: optionalText(120),
  notes: optionalText(1000),
  idempotencyKey: idempotencyKeySchema
});

export const salesCreditNotePostSchema = z.object({
  idempotencyKey: idempotencyKeySchema
});

export type SalesCreditNoteCreditableReturnListQuery = z.infer<typeof salesCreditNoteCreditableReturnListQuerySchema>;
export type SalesCreditNoteCreateFromReturnPayload = z.infer<typeof salesCreditNoteCreateFromReturnSchema>;
export type SalesCreditNoteListQuery = z.infer<typeof salesCreditNoteListQuerySchema>;
export type SalesCreditNotePostPayload = z.infer<typeof salesCreditNotePostSchema>;
