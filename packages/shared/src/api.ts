export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: ApiError;
};

export type PaginatedResponse<T> = ApiResponse<{
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;

