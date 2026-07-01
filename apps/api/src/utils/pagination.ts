import type { Pagination, PaginationInput, PaginationMeta } from "@doble-s-erp/shared";

const defaultPage = 1;
const defaultPageSize = 25;
const maxPageSize = 100;

function normalizePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export function getPagination(input: PaginationInput = {}): Pagination {
  const page = normalizePositiveInteger(input.page, defaultPage);
  const requestedPageSize = normalizePositiveInteger(input.pageSize, defaultPageSize);
  const pageSize = Math.min(requestedPageSize, maxPageSize);

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    limit: pageSize
  };
}

export function getPaginationMeta(pagination: Pagination, totalItems: number): PaginationMeta {
  const safeTotalItems = Math.max(0, totalItems);

  return {
    ...pagination,
    totalItems: safeTotalItems,
    totalPages: Math.ceil(safeTotalItems / pagination.pageSize)
  };
}
