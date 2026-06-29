import bcrypt from "bcryptjs";

import { AppError } from "../../../shared/errors/app-error.js";
import type { AuthenticatedUser } from "../domain/authenticated-user.js";
import { signAccessToken } from "../infrastructure/jwt.service.js";
import { findActiveUserByEmail } from "../infrastructure/user.repository.js";

export async function loginWithPassword(email: string, password: string) {
  const user = await findActiveUserByEmail(email);

  if (!user) {
    throw new AppError("Credenciales invalidas.", 401, "INVALID_CREDENTIALS");
  }

  const passwordMatches = await bcrypt.compare(password, user.PasswordHash);

  if (!passwordMatches) {
    throw new AppError("Credenciales invalidas.", 401, "INVALID_CREDENTIALS");
  }

  const authenticatedUser: AuthenticatedUser = {
    userId: user.UserId,
    tenantId: user.TenantId,
    companyId: user.CompanyId ?? undefined,
    email: user.Email,
    roles: user.Roles ? user.Roles.split(",") : []
  };

  return {
    accessToken: signAccessToken(authenticatedUser),
    user: authenticatedUser
  };
}
