import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const dateInputSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date");

export const accountingPeriodIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const accountingPeriodListQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(1900).max(2200).optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  isAdjustmentPeriod: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  dateFrom: dateInputSchema.optional(),
  dateTo: dateInputSchema.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const accountingPeriodCreateSchema = z.object({
  fiscalYear: z.number().int().min(1900).max(2200),
  periodNumber: z.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  startDate: dateInputSchema,
  endDate: dateInputSchema,
  isAdjustmentPeriod: z.boolean().optional()
});

export const accountingPeriodUpdateSchema = accountingPeriodCreateSchema;

export const accountingPeriodReopenSchema = z.object({
  reason: z.string().trim().min(1).max(500)
});

export type AccountingPeriodCreatePayload = z.infer<typeof accountingPeriodCreateSchema>;
export type AccountingPeriodUpdatePayload = z.infer<typeof accountingPeriodUpdateSchema>;
export type AccountingPeriodListQuery = z.infer<typeof accountingPeriodListQuerySchema>;
export type AccountingPeriodReopenPayload = z.infer<typeof accountingPeriodReopenSchema>;
