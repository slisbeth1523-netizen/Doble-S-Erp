import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const dateInputSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date");

export const postingSourceModuleSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .transform((value) => value.toUpperCase());

export const postingRequestSchema = z
  .object({
    sourceModule: postingSourceModuleSchema,
    documentId: uniqueIdentifierSchema,
    postingDate: dateInputSchema.optional(),
    reference: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(500).optional()
  })
  .strict();

export type PostingRequestPayload = z.infer<typeof postingRequestSchema>;
