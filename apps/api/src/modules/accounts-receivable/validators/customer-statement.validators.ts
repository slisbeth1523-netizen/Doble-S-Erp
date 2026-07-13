import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const asOfDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date in YYYY-MM-DD format")
  .optional();

export const customerStatementParamsSchema = z.object({
  customerId: uniqueIdentifierSchema
});

export const customerStatementQuerySchema = z.object({
  customerId: uniqueIdentifierSchema.optional(),
  asOfDate: asOfDateSchema,
  status: z.enum(["OPEN", "PARTIALLY_PAID", "PAID"]).optional(),
  agingBucket: z.enum(["CURRENT", "1-30", "31-60", "61-90", "90+"]).optional(),
  overdueOnly: z.coerce.boolean().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const customerAgingQuerySchema = z.object({
  customerId: uniqueIdentifierSchema.optional(),
  asOfDate: asOfDateSchema,
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export type CustomerStatementQuery = z.infer<typeof customerStatementQuerySchema>;
export type CustomerAgingQuery = z.infer<typeof customerAgingQuerySchema>;
