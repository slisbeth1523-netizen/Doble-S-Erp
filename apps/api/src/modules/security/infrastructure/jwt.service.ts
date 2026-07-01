import jwt from "jsonwebtoken";

import { config } from "../../../shared/config/config.js";
import { AppError } from "../../../shared/errors/app-error.js";
import type { AuthenticatedUser } from "../domain/authenticated-user.js";

export function signAccessToken(user: AuthenticatedUser) {
  const options: jwt.SignOptions = {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions["expiresIn"],
    subject: user.userId
  };

  return jwt.sign(user, config.jwt.secret, options);
}

export function verifyAccessToken(token: string): AuthenticatedUser {
  try {
    return jwt.verify(token, config.jwt.secret) as AuthenticatedUser;
  } catch {
    throw new AppError("Token invalido o expirado.", 401, "INVALID_TOKEN");
  }
}
