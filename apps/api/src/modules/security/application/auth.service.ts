import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

import { config } from "../../../shared/config/config.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { recordFunctionalAuditEvent } from "../../audit/infrastructure/audit.repository.js";
import type { AuthenticatedUser } from "../domain/authenticated-user.js";
import { signAccessToken } from "../infrastructure/jwt.service.js";
import { createSession, revokeSession } from "../infrastructure/session.repository.js";
import { findActiveUserByEmail } from "../infrastructure/user.repository.js";
import { getSessionExpiration } from "./session-expiration.js";

export async function loginWithPassword(email: string, password: string) {
  const user = await findActiveUserByEmail(email);

  if (!user) {
    throw new AppError("Credenciales invalidas.", 401, "INVALID_CREDENTIALS");
  }

  const passwordMatches = await bcrypt.compare(password, user.PasswordHash);

  if (!passwordMatches) {
    throw new AppError("Credenciales invalidas.", 401, "INVALID_CREDENTIALS");
  }

  const jwtId = randomUUID();
  const expiresAt = getSessionExpiration(config.jwt.expiresIn);

  const authenticatedUser: AuthenticatedUser = {
    userId: user.UserId,
    tenantId: user.TenantId,
    companyId: user.CompanyId ?? undefined,
    jwtId,
    email: user.Email,
    roles: user.Roles ? user.Roles.split(",") : []
  };

  await createSession({
    tenantId: authenticatedUser.tenantId,
    userId: authenticatedUser.userId,
    companyId: authenticatedUser.companyId,
    jwtId,
    expiresAt
  });

  await recordFunctionalAuditEvent({
    tenantId: authenticatedUser.tenantId,
    companyId: authenticatedUser.companyId,
    userId: authenticatedUser.userId,
    action: "USER_LOGIN",
    entityName: "security.Users",
    entityId: authenticatedUser.userId
  });

  return {
    accessToken: signAccessToken(authenticatedUser),
    expiresAt: expiresAt.toISOString(),
    user: authenticatedUser
  };
}

export async function logoutUser(user: AuthenticatedUser) {
  await revokeSession({
    tenantId: user.tenantId,
    userId: user.userId,
    jwtId: user.jwtId
  });

  await recordFunctionalAuditEvent({
    tenantId: user.tenantId,
    companyId: user.companyId,
    userId: user.userId,
    action: "USER_LOGOUT",
    entityName: "security.Sessions",
    entityId: user.jwtId
  });
}
