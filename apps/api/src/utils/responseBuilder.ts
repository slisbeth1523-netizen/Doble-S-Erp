import type { Response } from "express";
import type { ApiResponse } from "@doble-s-erp/shared";

export function buildSuccessResponse<T>(
  data: T,
  message?: string,
  meta?: Record<string, unknown>
): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
    meta
  };
}

export function buildErrorResponse(
  message: string,
  code = "ERROR",
  details?: unknown
): ApiResponse<never> {
  return {
    success: false,
    message,
    error: {
      code,
      message,
      details
    }
  };
}

export function buildFailureResponse<T>(message: string, data: T): ApiResponse<T> {
  return {
    success: false,
    message,
    data
  };
}

export function sendSuccess<T>(
  response: Response,
  data: T,
  statusCode = 200,
  message?: string,
  meta?: Record<string, unknown>
) {
  response.status(statusCode).json(buildSuccessResponse(data, message, meta));
}

export function sendError(
  response: Response,
  message: string,
  statusCode: number,
  code = "ERROR",
  details?: unknown
) {
  response.status(statusCode).json(buildErrorResponse(message, code, details));
}

export function sendFailure<T>(response: Response, message: string, data: T, statusCode: number) {
  response.status(statusCode).json(buildFailureResponse(message, data));
}
