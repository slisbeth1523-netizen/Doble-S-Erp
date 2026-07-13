import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const salesOrderIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const salesOrderQuotationIdParamsSchema = z.object({
  quotationId: uniqueIdentifierSchema
});

export const salesOrderLineIdParamsSchema = z.object({
  id: uniqueIdentifierSchema,
  lineId: uniqueIdentifierSchema
});

export const salesOrderStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "CLOSED"
]);

export const salesOrderListQuerySchema = z.object({
  customerId: uniqueIdentifierSchema.optional(),
  sourceQuotationId: uniqueIdentifierSchema.optional(),
  status: salesOrderStatusSchema.optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  requestedDeliveryFrom: z.string().date().optional(),
  requestedDeliveryTo: z.string().date().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const salesOrderCreateSchema = z.object({
  customerId: uniqueIdentifierSchema,
  orderDate: z.string().datetime({ offset: true }).optional(),
  requestedDeliveryDate: z.string().datetime({ offset: true }).optional().nullable(),
  currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  exchangeRate: z.number().positive().optional(),
  reference: optionalText(120),
  notes: optionalText(1000)
});

export const salesOrderUpdateSchema = z
  .object({
    customerId: uniqueIdentifierSchema.optional(),
    orderDate: z.string().datetime({ offset: true }).optional(),
    requestedDeliveryDate: z.string().datetime({ offset: true }).optional().nullable(),
    currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
    exchangeRate: z.number().positive().optional(),
    reference: optionalText(120),
    notes: optionalText(1000)
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required."
  });

export const salesOrderLineCreateSchema = z.object({
  itemId: uniqueIdentifierSchema,
  unitOfMeasureId: uniqueIdentifierSchema,
  warehouseId: uniqueIdentifierSchema.optional().nullable(),
  description: z.string().trim().min(1).max(300).optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100).optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  notes: optionalText(500)
});

export const salesOrderLineUpdateSchema = z
  .object({
    itemId: uniqueIdentifierSchema.optional(),
    unitOfMeasureId: uniqueIdentifierSchema.optional(),
    warehouseId: uniqueIdentifierSchema.optional().nullable(),
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

export const salesOrderCancelSchema = z.object({
  reason: z.string().trim().min(1).max(500)
});

export type SalesOrderCreatePayload = z.infer<typeof salesOrderCreateSchema>;
export type SalesOrderUpdatePayload = z.infer<typeof salesOrderUpdateSchema>;
export type SalesOrderListQuery = z.infer<typeof salesOrderListQuerySchema>;
export type SalesOrderLineCreatePayload = z.infer<typeof salesOrderLineCreateSchema>;
export type SalesOrderLineUpdatePayload = z.infer<typeof salesOrderLineUpdateSchema>;
export type SalesOrderCancelPayload = z.infer<typeof salesOrderCancelSchema>;
