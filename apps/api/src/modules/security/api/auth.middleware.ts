import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error.js";
import { isSessionActive } from "../infrastructure/session.repository.js";
import { verifyAccessToken } from "../infrastructure/jwt.service.js";

export const requireAuth: RequestHandler = async (request, _response, next) => {
  const authorization = request.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    next(new AppError("Autenticacion requerida.", 401, "AUTH_REQUIRED"));
    return;
  }

  try {
    const token = authorization.slice("Bearer ".length);
    const user = verifyAccessToken(token);
    const sessionActive = await isSessionActive({
      tenantId: user.tenantId,
      userId: user.userId,
      jwtId: user.jwtId
    });

    if (!sessionActive) {
      next(new AppError("Sesion invalida, revocada o vencida.", 401, "INVALID_SESSION"));
      return;
    }

    request.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
