import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const salesQuotationIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const salesQuotationLineIdParamsSchema = z.object({
  id: uniqueIdentifierSchema,
  lineId: uniqueIdentifierSchema
});

export const salesQuotationStatusSchema = z.enum([
  "DRAFT",
  "SENT",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CONVERTED"
]);

export const salesQuotationListQuerySchema = z.object({
  customerId: uniqueIdentifierSchema.optional(),
  status: salesQuotationStatusSchema.optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  validUntilFrom: z.string().date().optional(),
  validUntilTo: z.string().date().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const salesQuotationCreateSchema = z.object({
  customerId: uniqueIdentifierSchema,
  quotationDate: z.string().datetime({ offset: true }).optional(),
  validUntil: z.string().datetime({ offset: true }),
  currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  exchangeRate: z.number().positive().optional(),
  reference: optionalText(120),
  notes: optionalText(1000)
});

export const salesQuotationUpdateSchema = z
  .object({
    customerId: uniqueIdentifierSchema.optional(),
    quotationDate: z.string().datetime({ offset: true }).optional(),
    validUntil: z.string().datetime({ offset: true }).optional(),
    currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
    exchangeRate: z.number().positive().optional(),
    reference: optionalText(120),
    notes: optionalText(1000)
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required."
  });

export const salesQuotationLineCreateSchema = z.object({
  itemId: uniqueIdentifierSchema,
  unitOfMeasureId: uniqueIdentifierSchema,
  description: z.string().trim().min(1).max(300).optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100).optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  notes: optionalText(500)
});

export const salesQuotationLineUpdateSchema = z
  .object({
    itemId: uniqueIdentifierSchema.optional(),
    unitOfMeasureId: uniqueIdentifierSchema.optional(),
    description: z.string().trim().min(1).max(300).optional(),
    quantity: z.number().positive().optional(),
    unitPrice: z.number().min(0).optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    taxPercent: z.number().min(0).max(100).optional(),
    notes: optionalText(500)
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required."
  });

export type SalesQuotationCreatePayload = z.infer<typeof salesQuotationCreateSchema>;
export type SalesQuotationUpdatePayload = z.infer<typeof salesQuotationUpdateSchema>;
export type SalesQuotationListQuery = z.infer<typeof salesQuotationListQuerySchema>;
export type SalesQuotationLineCreatePayload = z.infer<typeof salesQuotationLineCreateSchema>;
export type SalesQuotationLineUpdatePayload = z.infer<typeof salesQuotationLineUpdateSchema>;
