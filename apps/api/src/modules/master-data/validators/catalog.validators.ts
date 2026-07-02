import { z } from "zod";

const sqlGuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid GUID");

const uuidParam = z.preprocess(
  (value) => (typeof value === "string" ? value.toLowerCase() : value),
  sqlGuidSchema
);

export const catalogParamsSchema = z.object({
  catalog: z.string().min(1).max(80),
  id: uuidParam.optional()
});

const booleanQuery = z.preprocess((value) => {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}, z.boolean().optional());

export const catalogQuerySchema = z.object({
  search: z.string().max(160).optional(),
  isActive: booleanQuery,
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.string().max(80).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional()
});

export const catalogLookupQuerySchema = z.object({
  search: z.string().max(160).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const catalogPayloadSchema = z.object({
  code: z.string().min(1).max(80),
  name: z.string().min(1).max(300),
  description: z.string().max(250).nullable().optional(),
  companyId: sqlGuidSchema.nullable().optional(),
  isActive: z.boolean().optional()
}).passthrough();

export const catalogImportPreviewSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).max(100).optional()
});
