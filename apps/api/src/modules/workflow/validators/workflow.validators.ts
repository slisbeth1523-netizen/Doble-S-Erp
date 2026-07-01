import { z } from "zod";

export const workflowIdParamsSchema = z.object({
  workflowId: z.string().uuid()
});

export const workflowEntityParamsSchema = workflowIdParamsSchema.extend({
  entityName: z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9_.-]+$/),
  entityId: z.string().trim().min(1).max(120)
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

export const workflowEntityInitializeSchema = z.object({
  initialStateId: z.string().uuid()
});

export const workflowEntityTransitionSchema = z.object({
  transitionId: z.string().uuid(),
  comment: z.string().trim().max(500).nullable().optional()
});

export const workflowHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});
