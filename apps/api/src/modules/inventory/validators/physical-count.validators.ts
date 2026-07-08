import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

export const physicalCountIdParamsSchema = z.object({
  id: uniqueIdentifierSchema
});

export const physicalCountCreateSchema = z.object({
  warehouseId: uniqueIdentifierSchema,
  countDate: z.string().datetime({ offset: true }).optional(),
  reference: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable()
});

export const physicalCountLineCreateSchema = z.object({
  itemId: uniqueIdentifierSchema,
  countedQuantity: z.number().min(0),
  unitCost: z.number().min(0).optional(),
  notes: z.string().trim().max(500).optional().nullable()
});

export type PhysicalCountCreatePayload = z.infer<typeof physicalCountCreateSchema>;
export type PhysicalCountLineCreatePayload = z.infer<typeof physicalCountLineCreateSchema>;
