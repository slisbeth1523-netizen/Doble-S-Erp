import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const dateInputSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date");

export const accountsReceivableDocumentIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const customerBalanceParamsSchema = z.object({
  customerId: uniqueIdentifierSchema
});

export const accountsReceivableDocumentListQuerySchema = z.object({
  customerId: uniqueIdentifierSchema.optional(),
  status: z.enum(["OPEN", "PARTIALLY_PAID", "PAID", "CANCELLED"]).optional(),
  sourceType: z.enum(["MANUAL", "SALES_INVOICE", "CUSTOMER_DEBIT_NOTE", "OPENING_BALANCE"]).optional(),
  overdueOnly: z.coerce.boolean().optional(),
  dateFrom: dateInputSchema.optional(),
  dateTo: dateInputSchema.optional(),
  dueDateFrom: dateInputSchema.optional(),
  dueDateTo: dateInputSchema.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const customerBalanceListQuerySchema = z.object({
  customerId: uniqueIdentifierSchema.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const accountsReceivableDocumentCreateSchema = z
  .object({
    customerId: uniqueIdentifierSchema,
    sourceType: z.enum(["MANUAL", "CUSTOMER_DEBIT_NOTE", "OPENING_BALANCE"]),
    documentDate: dateInputSchema.optional(),
    dueDate: dateInputSchema,
    currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()),
    exchangeRate: z.number().positive().default(1),
    totalAmount: z.number().positive(),
    reference: z.string().trim().max(120).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable()
  })
  .superRefine((value, context) => {
    const documentDate = value.documentDate ? new Date(value.documentDate) : new Date(new Date().toISOString().slice(0, 10));
    const dueDate = new Date(value.dueDate);

    if (dueDate < documentDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dueDate"],
        message: "Due date cannot be earlier than document date."
      });
    }
  });

export type AccountsReceivableDocumentCreatePayload = z.infer<typeof accountsReceivableDocumentCreateSchema>;
export type AccountsReceivableDocumentListQuery = z.infer<typeof accountsReceivableDocumentListQuerySchema>;
export type CustomerBalanceListQuery = z.infer<typeof customerBalanceListQuerySchema>;
