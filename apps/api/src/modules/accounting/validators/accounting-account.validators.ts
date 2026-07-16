import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const nullableUniqueIdentifierSchema = z
  .union([uniqueIdentifierSchema, z.literal(""), z.null()])
  .transform((value) => (value ? value : undefined))
  .optional();

const dateInputSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date");

export const accountTypeSchema = z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE", "COST", "MEMO"]);
export const normalBalanceSchema = z.enum(["DEBIT", "CREDIT"]);

export const accountingAccountIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const accountingAccountListQuerySchema = z.object({
  parentAccountId: nullableUniqueIdentifierSchema,
  accountType: accountTypeSchema.optional(),
  normalBalance: normalBalanceSchema.optional(),
  allowsPosting: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  requiresCostCenter: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  isBlocked: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  validOn: dateInputSchema.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional()
});

export const accountingAccountPayloadSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional().nullable(),
  parentAccountId: nullableUniqueIdentifierSchema,
  accountType: accountTypeSchema,
  normalBalance: normalBalanceSchema,
  classification: z.string().trim().max(40).optional().nullable(),
  allowsPosting: z.boolean().optional(),
  requiresCostCenter: z.boolean().optional(),
  requiresThirdParty: z.boolean().optional(),
  isControlAccount: z.boolean().optional(),
  currencyCode: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .optional()
    .nullable(),
  validFrom: dateInputSchema.optional().nullable(),
  validTo: dateInputSchema.optional().nullable()
});

export const accountingAccountBlockSchema = z.object({
  reason: z.string().trim().min(1).max(500)
});

export type AccountingAccountPayload = z.infer<typeof accountingAccountPayloadSchema>;
export type AccountingAccountListQuery = z.infer<typeof accountingAccountListQuerySchema>;
export type AccountingAccountBlockPayload = z.infer<typeof accountingAccountBlockSchema>;
