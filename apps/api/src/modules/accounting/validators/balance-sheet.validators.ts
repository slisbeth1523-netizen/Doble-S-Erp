import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const dateInputSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date");

export const balanceSheetQuerySchema = z
  .object({
    asOfDate: dateInputSchema.optional(),
    compareAsOfDate: dateInputSchema.optional(),
    costCenterId: uniqueIdentifierSchema.optional(),
    sourceModule: z.string().trim().max(40).optional(),
    sourceDocumentType: z.string().trim().max(50).optional(),
    currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
    search: z.string().trim().max(120).optional()
  })
  .refine((query) => !query.compareAsOfDate || !query.asOfDate || query.compareAsOfDate <= query.asOfDate, {
    message: "compareAsOfDate cannot be later than asOfDate",
    path: ["compareAsOfDate"]
  });

export type BalanceSheetQuery = z.infer<typeof balanceSheetQuerySchema>;
