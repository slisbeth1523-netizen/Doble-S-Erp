import type { BaseFilters } from "@doble-s-erp/shared";
import { clock } from "./clock.js";

function normalizeDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return undefined;
  }

  const date = clock.parse(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function getBaseFilters(input: Record<string, unknown>): BaseFilters {
  return {
    search: typeof input.search === "string" && input.search.trim() ? input.search.trim() : undefined,
    isActive: typeof input.isActive === "boolean" ? input.isActive : undefined,
    createdFrom: normalizeDate(input.createdFrom),
    createdTo: normalizeDate(input.createdTo)
  };
}
