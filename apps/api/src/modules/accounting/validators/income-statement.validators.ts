import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const dateInputSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date");

export const incomeStatementQuerySchema = z
  .object({
    accountingPeriodId: uniqueIdentifierSchema.optional(),
    fiscalYear: z.coerce.number().int().min(1900).max(2200).optional(),
    periodNumber: z.coerce.number().int().positive().optional(),
    costCenterId: uniqueIdentifierSchema.optional(),
    sourceModule: z.string().trim().max(40).optional(),
    sourceDocumentType: z.string().trim().max(50).optional(),
    currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
    dateFrom: dateInputSchema.optional(),
    dateTo: dateInputSchema.optional(),
    compareAccountingPeriodId: uniqueIdentifierSchema.optional(),
    compareDateFrom: dateInputSchema.optional(),
    compareDateTo: dateInputSchema.optional(),
    search: z.string().trim().max(120).optional()
  })
  .refine((query) => !query.dateFrom || !query.dateTo || query.dateTo >= query.dateFrom, {
    message: "dateTo cannot be earlier than dateFrom",
    path: ["dateTo"]
  })
  .refine((query) => !query.compareDateFrom || !query.compareDateTo || query.compareDateTo >= query.compareDateFrom, {
    message: "compareDateTo cannot be earlier than compareDateFrom",
    path: ["compareDateTo"]
  });

export type IncomeStatementQuery = z.infer<typeof incomeStatementQuerySchema>;
