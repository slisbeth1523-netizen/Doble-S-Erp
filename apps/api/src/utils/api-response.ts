import type { ApiResponse } from "@doble-s-erp/shared";
import { buildErrorResponse, buildFailureResponse, buildSuccessResponse } from "./responseBuilder.js";

export function ok<T>(data: T, message?: string, meta?: Record<string, unknown>): ApiResponse<T> {
  return buildSuccessResponse(data, message, meta);
}

export function fail(message: string, code = "ERROR", details?: unknown): ApiResponse<never> {
  return buildErrorResponse(message, code, details);
}

export function failWithData<T>(message: string, data: T): ApiResponse<T> {
  return buildFailureResponse(message, data);
}
