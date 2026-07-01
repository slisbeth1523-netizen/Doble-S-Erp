import type { SortDirection, Sorting } from "@doble-s-erp/shared";

const defaultDirection: SortDirection = "asc";

function normalizeSortDirection(value: unknown): SortDirection {
  return value === "desc" ? "desc" : defaultDirection;
}

export function getSorting<TAllowedSort extends string>(
  input: {
    sortBy?: unknown;
    sortDirection?: unknown;
  },
  allowedSortColumns: readonly TAllowedSort[],
  defaultSortBy: TAllowedSort
): Sorting<TAllowedSort> {
  const sortBy = allowedSortColumns.includes(input.sortBy as TAllowedSort)
    ? (input.sortBy as TAllowedSort)
    : defaultSortBy;

  return {
    sortBy,
    sortDirection: normalizeSortDirection(input.sortDirection)
  };
}

export function getSafeOrderBy<TAllowedSort extends string>(
  sorting: Sorting<TAllowedSort>,
  columnMap: Record<TAllowedSort, string>
) {
  return `${columnMap[sorting.sortBy]} ${sorting.sortDirection.toUpperCase()}`;
}
