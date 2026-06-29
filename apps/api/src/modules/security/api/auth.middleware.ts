import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error.js";
import { verifyAccessToken } from "../infrastructure/jwt.service.js";

export const requireAuth: RequestHandler = (request, _response, next) => {
  const authorization = request.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    next(new AppError("Autenticacion requerida.", 401, "AUTH_REQUIRED"));
    return;
  }

  const token = authorization.slice("Bearer ".length);
  request.user = verifyAccessToken(token);
  next();
};
