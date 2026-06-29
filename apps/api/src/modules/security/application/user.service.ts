import bcrypt from "bcryptjs";

import { createUser } from "../infrastructure/user.repository.js";

const passwordSaltRounds = 12;

export async function createUserWithPassword(input: {
  tenantId: string;
  defaultCompanyId?: string;
  email: string;
  displayName: string;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(input.password, passwordSaltRounds);

  return createUser({
    tenantId: input.tenantId,
    defaultCompanyId: input.defaultCompanyId,
    email: input.email,
    displayName: input.displayName,
    passwordHash
  });
}
