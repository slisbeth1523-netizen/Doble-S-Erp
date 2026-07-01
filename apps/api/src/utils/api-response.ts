import type { ApiResponse } from "@doble-s-erp/shared";

export function ok<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    message,
    data
  };
}

export function fail(message: string, code = "ERROR"): ApiResponse<never> {
  return {
    success: false,
    message,
    error: {
      code,
      message
    }
  };
}

