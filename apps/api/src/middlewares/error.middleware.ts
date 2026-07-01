import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { AppError, ValidationError } from "../errors/index.js";
import { fail } from "../utils/api-response.js";
import { logger } from "../utils/logger.js";

export const errorMiddleware: ErrorRequestHandler = (error, request, response, _next) => {
  const appError =
    error instanceof ZodError
      ? new ValidationError("Validation failed", error.flatten())
      : error instanceof AppError
        ? error
        : new AppError({
            statusCode: 500,
            code: "INTERNAL_SERVER_ERROR",
            message: "Unexpected error",
            isOperational: false
          });

  if (!appError.isOperational) {
    logger.error("Unhandled API error", {
      method: request.method,
      path: request.originalUrl,
      code: appError.code
    });
  }

  response.status(appError.statusCode).json(fail(appError.message, appError.code, appError.details));
};
