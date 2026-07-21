import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const dateInputSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date");

export const salesAccountingSourceSchema = z.enum(["SALES_INVOICE", "CUSTOMER_CREDIT_NOTE", "CUSTOMER_DEBIT_NOTE"]);

export const accountingSalesPayloadSchema = z
  .object({
    sourceDocumentType: salesAccountingSourceSchema.default("SALES_INVOICE"),
    documentId: uniqueIdentifierSchema,
    postingDate: dateInputSchema.optional(),
    reference: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(500).optional()
  })
  .strict();

export const accountingSalesJournalParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const accountingSalesJournalQuerySchema = z.object({
  sourceDocumentType: salesAccountingSourceSchema.default("SALES_INVOICE")
});

export type AccountingSalesPayload = z.infer<typeof accountingSalesPayloadSchema>;
export type AccountingSalesJournalQuery = z.infer<typeof accountingSalesJournalQuerySchema>;
