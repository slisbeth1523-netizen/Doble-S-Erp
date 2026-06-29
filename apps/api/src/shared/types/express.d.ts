import type { AuthenticatedUser } from "../../modules/security/domain/authenticated-user.js";
import type { TenantContext } from "../../modules/core/domain/tenant-context.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenantContext?: TenantContext;
    }
  }
}

export {};
