import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { requireTenantContext } from "../../../core/api/tenant-context.middleware.js";
import { createUserWithPassword } from "../../application/user.service.js";
import { listPermissions, listRoles, createRole } from "../../infrastructure/security.repository.js";
import { listUsers } from "../../infrastructure/user.repository.js";
import { requireAuth } from "../auth.middleware.js";

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(200),
  password: z.string().min(8),
  defaultCompanyId: z.string().uuid().optional()
});

const createRoleSchema = z.object({
  code: z.string().min(1).max(80),
  name: z.string().min(1).max(160)
});

export const securityRouter = Router();

securityRouter.use(requireAuth, requireTenantContext);

securityRouter.get(
  "/users",
  asyncHandler(async (request, response) => {
    const users = await listUsers(request.tenantContext!.tenantId);
    response.json({ data: users });
  })
);

securityRouter.post(
  "/users",
  asyncHandler(async (request, response) => {
    const body = createUserSchema.parse(request.body);
    const user = await createUserWithPassword({
      tenantId: request.tenantContext!.tenantId,
      defaultCompanyId: body.defaultCompanyId,
      email: body.email,
      displayName: body.displayName,
      password: body.password
    });

    response.status(201).json({ data: user });
  })
);

securityRouter.get(
  "/roles",
  asyncHandler(async (request, response) => {
    const roles = await listRoles(request.tenantContext!.tenantId);
    response.json({ data: roles });
  })
);

securityRouter.post(
  "/roles",
  asyncHandler(async (request, response) => {
    const body = createRoleSchema.parse(request.body);
    const role = await createRole({
      tenantId: request.tenantContext!.tenantId,
      code: body.code,
      name: body.name
    });

    response.status(201).json({ data: role });
  })
);

securityRouter.get(
  "/permissions",
  asyncHandler(async (_request, response) => {
    const permissions = await listPermissions();
    response.json({ data: permissions });
  })
);
