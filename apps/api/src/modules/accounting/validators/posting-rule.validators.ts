import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());
const nullableUniqueIdentifierSchema = uniqueIdentifierSchema.nullable().optional();

const sourceModuleSchema = z.enum(["ACCOUNTS_RECEIVABLE", "ACCOUNTS_PAYABLE", "SALES", "PURCHASING"]);
const sourceDocumentTypeSchema = z.enum(["AR_DOCUMENT", "AP_DOCUMENT", "SALES_INVOICE", "SUPPLIER_INVOICE"]);
const directionSchema = z.enum(["RECEIVABLE", "PAYABLE"]);

export const postingRuleIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const postingRuleListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().trim().max(120).optional(),
  sourceModule: sourceModuleSchema.optional(),
  sourceDocumentType: sourceDocumentTypeSchema.optional(),
  direction: directionSchema.optional(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true").optional()
});

export const postingRulePayloadSchema = z.object({
  ruleCode: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(500).optional(),
  sourceModule: sourceModuleSchema,
  sourceDocumentType: sourceDocumentTypeSchema,
  direction: directionSchema,
  debitAccountId: uniqueIdentifierSchema,
  creditAccountId: uniqueIdentifierSchema,
  taxAccountId: nullableUniqueIdentifierSchema,
  costCenterId: nullableUniqueIdentifierSchema,
  appliesTax: z.boolean().default(true),
  priority: z.coerce.number().int().min(1).max(9999).default(100),
  isDefault: z.boolean().default(false),
  validFrom: z.string().date().optional(),
  validTo: z.string().date().optional(),
  isActive: z.boolean().default(true)
});

export type PostingRuleIdParams = z.infer<typeof postingRuleIdParamsSchema>;
export type PostingRuleListQuery = z.infer<typeof postingRuleListQuerySchema>;
export type PostingRulePayload = z.infer<typeof postingRulePayloadSchema>;
