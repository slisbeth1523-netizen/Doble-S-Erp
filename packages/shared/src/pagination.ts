export type PaginationInput = {
  page?: number;
  pageSize?: number;
};

export type Pagination = {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
};

export type PaginationMeta = Pagination & {
  totalItems: number;
  totalPages: number;
};
