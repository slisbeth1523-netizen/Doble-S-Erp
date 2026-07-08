import { z } from "zod";

export const inventoryMovementIdParamsSchema = z.object({
  id: z.string().uuid()
});
