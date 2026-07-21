import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const dateInputSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date");

export const salesAccountingDocumentParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const salesAccountingPayloadSchema = z
  .object({
    postingDate: dateInputSchema.optional(),
    reference: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(500).optional()
  })
  .strict();

export type SalesAccountingPayload = z.infer<typeof salesAccountingPayloadSchema>;
