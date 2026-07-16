import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const dateInputSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date");

const currencyCodeSchema = z.string().trim().length(3).transform((value) => value.toUpperCase());

export const journalEntryIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const journalEntryLineIdParamsSchema = z.object({
  id: uniqueIdentifierSchema,
  lineId: uniqueIdentifierSchema
});

export const journalEntryListQuerySchema = z.object({
  accountingPeriodId: uniqueIdentifierSchema.optional(),
  fiscalYear: z.coerce.number().int().min(1900).max(2200).optional(),
  periodNumber: z.coerce.number().int().positive().optional(),
  status: z.enum(["DRAFT", "POSTED"]).optional(),
  accountId: uniqueIdentifierSchema.optional(),
  costCenterId: uniqueIdentifierSchema.optional(),
  sourceModule: z.string().trim().max(40).optional(),
  dateFrom: dateInputSchema.optional(),
  dateTo: dateInputSchema.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const journalEntryCreateSchema = z.object({
  entryDate: dateInputSchema,
  description: z.string().trim().min(1).max(500),
  reference: z.string().trim().max(120).optional(),
  currencyCode: currencyCodeSchema,
  exchangeRate: z.number().positive().max(999999999999.999999)
});

export const journalEntryUpdateSchema = journalEntryCreateSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  "At least one field is required"
);

export const journalEntryLinePayloadSchema = z
  .object({
    accountId: uniqueIdentifierSchema,
    costCenterId: uniqueIdentifierSchema.optional(),
    description: z.string().trim().min(1).max(500),
    debitAmount: z.number().min(0).max(999999999999.9999),
    creditAmount: z.number().min(0).max(999999999999.9999),
    reference: z.string().trim().max(120).optional()
  })
  .refine((payload) => payload.debitAmount > 0 || payload.creditAmount > 0, {
    message: "Debit or credit amount is required",
    path: ["debitAmount"]
  })
  .refine((payload) => !(payload.debitAmount > 0 && payload.creditAmount > 0), {
    message: "Debit and credit cannot both be greater than zero",
    path: ["creditAmount"]
  });

export const journalEntryPostSchema = z
  .object({
    idempotencyKey: z.string().trim().min(1).max(120),
    requestHash: z.string().trim().max(120).optional()
  })
  .strict();

export type JournalEntryListQuery = z.infer<typeof journalEntryListQuerySchema>;
export type JournalEntryCreatePayload = z.infer<typeof journalEntryCreateSchema>;
export type JournalEntryUpdatePayload = z.infer<typeof journalEntryUpdateSchema>;
export type JournalEntryLinePayload = z.infer<typeof journalEntryLinePayloadSchema>;
export type JournalEntryPostPayload = z.infer<typeof journalEntryPostSchema>;
