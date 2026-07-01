import type { ErrorRequestHandler } from "express";

import { fail } from "../utils/api-response.js";

export const errorMiddleware: ErrorRequestHandler = (error, _request, response, _next) => {
  response.status(500).json(fail(error instanceof Error ? error.message : "Unexpected error"));
};

