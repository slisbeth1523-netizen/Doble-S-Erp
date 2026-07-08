import { z } from "zod";

const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID")
  .transform((value) => value.toLowerCase());

const adjustmentLineSchema = z.object({
  itemId: uuidSchema,
  warehouseId: uuidSchema,
  unitOfMeasureId: uuidSchema.optional().nullable(),
  quantity: z.number().positive(),
  unitCost: z.number().min(0).optional(),
  notes: z.string().trim().max(500).optional().nullable()
});

export const inventoryAdjustmentCreateSchema = z.object({
  movementType: z.enum(["ADJUSTMENT_IN", "ADJUSTMENT_OUT"]),
  movementDate: z.string().datetime({ offset: true }).optional(),
  reference: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  lines: z.array(adjustmentLineSchema).min(1)
});

export type InventoryAdjustmentCreatePayload = z.infer<typeof inventoryAdjustmentCreateSchema>;
