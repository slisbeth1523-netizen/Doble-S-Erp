import { z } from "zod";

export const workflowIdParamsSchema = z.object({
  workflowId: z.string().uuid()
});

export const workflowCreateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(250).nullable().optional(),
  isActive: z.boolean().optional()
});

export const workflowStateCreateSchema = workflowCreateSchema;

export const workflowTransitionCreateSchema = workflowCreateSchema.extend({
  fromStateId: z.string().uuid(),
  toStateId: z.string().uuid()
});
