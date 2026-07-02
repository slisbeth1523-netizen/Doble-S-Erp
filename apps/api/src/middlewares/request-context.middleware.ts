import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

import { getRequestContext } from "../utils/requestContext.js";

export const requestContextMiddleware: RequestHandler = (request, response, next) => {
  const requestId = randomUUID();
  const correlationHeader = request.header("x-correlation-id");
  const correlationId = correlationHeader && correlationHeader.trim() ? correlationHeader : requestId;

  request.requestContext = {
    ...getRequestContext(request),
    requestId,
    correlationId
  };

  response.setHeader("x-request-id", requestId);
  response.setHeader("x-correlation-id", correlationId);

  next();
};
