import type { Request } from "express";
import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { auditEvent } from "../../../../utils/audit.js";
import { logger } from "../../../../utils/logger.js";
import { getRequestContext } from "../../../../utils/requestContext.js";
import { sendSuccess } from "../../../../utils/responseBuilder.js";
import { validateRequest } from "../../../../utils/validateRequest.js";
import { requireTenantContext } from "../../../core/api/tenant-context.middleware.js";
import { enterpriseSecurityService } from "../../application/enterprise-security.service.js";
import { securityEngineService } from "../../application/security-engine.service.js";
import { requireAuth } from "../auth.middleware.js";
import { requirePermission } from "../permission.middleware.js";

const idParamSchema = z.object({
  userId: z.string().uuid().optional(),
  roleId: z.string().uuid().optional(),
  permissionId: z.string().uuid().optional(),
  moduleId: z.string().uuid().optional(),
  actionId: z.string().uuid().optional(),
  navigationId: z.string().uuid().optional(),
  policyId: z.string().uuid().optional(),
  licenseId: z.string().uuid().optional(),
  flagId: z.string().uuid().optional()
});

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(200),
  password: z.string().min(8),
  defaultCompanyId: z.string().uuid().optional()
});

const updateUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(200),
  defaultCompanyId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true)
});

const roleSchema = z.object({
  code: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  isActive: z.boolean().default(true)
});

const permissionSchema = z.object({
  moduleCode: z.string().min(1).max(80),
  actionCode: z.string().min(1).max(80),
  description: z.string().max(250).nullable().optional(),
  isActive: z.boolean().default(true)
});

const catalogSchema = z.object({
  code: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  description: z.string().max(250).nullable().optional(),
  isActive: z.boolean().default(true)
});

const userRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid()
});

const rolePermissionSchema = z.object({
  roleId: z.string().uuid(),
  permissionId: z.string().uuid()
});

const navigationSchema = z.object({
  tenantId: z.string().uuid().nullable().optional(),
  moduleId: z.string().uuid().nullable().optional(),
  parentNavigationId: z.string().uuid().nullable().optional(),
  label: z.string().min(1).max(160),
  route: z.string().max(250).nullable().optional(),
  icon: z.string().max(80).nullable().optional(),
  displayOrder: z.number().int().default(0),
  isVisible: z.boolean().default(true),
  isActive: z.boolean().default(true),
  requiredPermissionCode: z.string().max(180).nullable().optional()
});

const policySchema = z.object({
  code: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  description: z.string().max(250).nullable().optional(),
  scopeCode: z.enum(["OWN_RECORDS", "BRANCH_ONLY", "COMPANY_ONLY", "TENANT_WIDE"]),
  isActive: z.boolean().default(true)
});

const moduleLicenseSchema = z.object({
  moduleId: z.string().uuid(),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional()
});

const featureFlagSchema = z.object({
  code: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  description: z.string().max(250).nullable().optional(),
  isEnabled: z.boolean().default(false),
  isActive: z.boolean().default(true)
});

export const securityRouter = Router();

securityRouter.use(requireAuth, requireTenantContext);
securityRouter.use((request, _response, next) => {
  const context = getRequestContext(request);
  logger.debug("Security endpoint requested", {
    method: request.method,
    path: request.originalUrl,
    tenantId: context.tenantId,
    userId: context.userId,
    requestId: context.requestId
  });
  next();
});

function tenantIdFrom(request: Request) {
  return request.tenantContext!.tenantId;
}

async function auditSecurityChange(
  request: Request,
  action: string,
  entity: string,
  entityId?: string,
  metadata?: Record<string, unknown>
) {
  const context = getRequestContext(request);

  await auditEvent({
    tenantId: context.tenantId,
    companyId: context.companyId,
    userId: context.userId,
    action,
    entity,
    entityId,
    metadata: {
      ...metadata,
      requestId: context.requestId,
      correlationId: context.correlationId
    }
  });
}

securityRouter.get(
  "/me/context",
  asyncHandler(async (request, response) => {
    const context = getRequestContext(request);
    const userContext = await securityEngineService.getUserContext({
      tenantId: tenantIdFrom(request),
      userId: request.user!.userId,
      companyId: context.companyId,
      user: request.user
    });

    sendSuccess(response, userContext);
  })
);

securityRouter.get(
  "/navigation",
  requirePermission("security", "navigation.read"),
  asyncHandler(async (request, response) => {
    const navigation = await securityEngineService.listNavigation(tenantIdFrom(request));
    sendSuccess(response, navigation);
  })
);

securityRouter.post(
  "/navigation",
  requirePermission("security", "navigation.create"),
  validateRequest({ body: navigationSchema }),
  asyncHandler(async (request, response) => {
    const navigation = await securityEngineService.createNavigation(request.body);
    await auditSecurityChange(
      request,
      "SECURITY_NAVIGATION_CREATED",
      "security.NavigationItems",
      navigation.NavigationId
    );
    sendSuccess(response, navigation, 201);
  })
);

securityRouter.put(
  "/navigation/:navigationId",
  requirePermission("security", "navigation.update"),
  validateRequest({ params: idParamSchema, body: navigationSchema }),
  asyncHandler(async (request, response) => {
    const navigation = await securityEngineService.updateNavigation({
      navigationId: request.params.navigationId!,
      ...request.body
    });
    await auditSecurityChange(
      request,
      "SECURITY_NAVIGATION_UPDATED",
      "security.NavigationItems",
      navigation.NavigationId
    );
    sendSuccess(response, navigation);
  })
);

securityRouter.delete(
  "/navigation/:navigationId",
  requirePermission("security", "navigation.delete"),
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (request, response) => {
    const navigation = await securityEngineService.deleteNavigation(request.params.navigationId!);
    await auditSecurityChange(
      request,
      "SECURITY_NAVIGATION_DEACTIVATED",
      "security.NavigationItems",
      navigation.NavigationId
    );
    sendSuccess(response, navigation);
  })
);

securityRouter.get(
  "/policies",
  requirePermission("security", "policies.read"),
  asyncHandler(async (_request, response) => {
    const policies = await securityEngineService.listPolicies();
    sendSuccess(response, policies);
  })
);

securityRouter.post(
  "/policies",
  requirePermission("security", "policies.create"),
  validateRequest({ body: policySchema }),
  asyncHandler(async (request, response) => {
    const policy = await securityEngineService.createPolicy(request.body);
    await auditSecurityChange(request, "SECURITY_POLICY_CREATED", "security.AccessPolicies", policy.PolicyId);
    sendSuccess(response, policy, 201);
  })
);

securityRouter.put(
  "/policies/:policyId",
  requirePermission("security", "policies.update"),
  validateRequest({ params: idParamSchema, body: policySchema }),
  asyncHandler(async (request, response) => {
    const policy = await securityEngineService.updatePolicy({
      policyId: request.params.policyId!,
      ...request.body
    });
    await auditSecurityChange(request, "SECURITY_POLICY_UPDATED", "security.AccessPolicies", policy.PolicyId);
    sendSuccess(response, policy);
  })
);

securityRouter.delete(
  "/policies/:policyId",
  requirePermission("security", "policies.delete"),
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (request, response) => {
    const policy = await securityEngineService.deletePolicy(request.params.policyId!);
    await auditSecurityChange(
      request,
      "SECURITY_POLICY_DEACTIVATED",
      "security.AccessPolicies",
      policy.PolicyId
    );
    sendSuccess(response, policy);
  })
);

securityRouter.get(
  "/licenses/modules",
  requirePermission("security", "licenses.read"),
  asyncHandler(async (request, response) => {
    const licenses = await securityEngineService.listModuleLicenses(tenantIdFrom(request));
    sendSuccess(response, licenses);
  })
);

securityRouter.post(
  "/licenses/modules",
  requirePermission("security", "licenses.assign"),
  validateRequest({ body: moduleLicenseSchema }),
  asyncHandler(async (request, response) => {
    const license = await securityEngineService.createModuleLicense({
      tenantId: tenantIdFrom(request),
      ...request.body
    });
    await auditSecurityChange(
      request,
      "SECURITY_MODULE_LICENSE_ASSIGNED",
      "security.TenantModuleLicenses",
      license.LicenseId
    );
    sendSuccess(response, license, 201);
  })
);

securityRouter.delete(
  "/licenses/modules/:licenseId",
  requirePermission("security", "licenses.revoke"),
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (request, response) => {
    const license = await securityEngineService.deleteModuleLicense(
      tenantIdFrom(request),
      request.params.licenseId!
    );
    await auditSecurityChange(
      request,
      "SECURITY_MODULE_LICENSE_REVOKED",
      "security.TenantModuleLicenses",
      license.LicenseId
    );
    sendSuccess(response, license);
  })
);

securityRouter.get(
  "/feature-flags",
  requirePermission("security", "feature-flags.read"),
  asyncHandler(async (request, response) => {
    const flags = await securityEngineService.listFeatureFlags(tenantIdFrom(request));
    sendSuccess(response, flags);
  })
);

securityRouter.post(
  "/feature-flags",
  requirePermission("security", "feature-flags.create"),
  validateRequest({ body: featureFlagSchema }),
  asyncHandler(async (request, response) => {
    const flag = await securityEngineService.createFeatureFlag(request.body);
    await auditSecurityChange(request, "SECURITY_FEATURE_FLAG_CREATED", "security.FeatureFlags", flag.FlagId);
    sendSuccess(response, flag, 201);
  })
);

securityRouter.put(
  "/feature-flags/:flagId",
  requirePermission("security", "feature-flags.update"),
  validateRequest({ params: idParamSchema, body: featureFlagSchema }),
  asyncHandler(async (request, response) => {
    const flag = await securityEngineService.updateFeatureFlag({
      flagId: request.params.flagId!,
      ...request.body
    });
    await auditSecurityChange(request, "SECURITY_FEATURE_FLAG_UPDATED", "security.FeatureFlags", flag.FlagId);
    sendSuccess(response, flag);
  })
);

securityRouter.delete(
  "/feature-flags/:flagId",
  requirePermission("security", "feature-flags.delete"),
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (request, response) => {
    const flag = await securityEngineService.deleteFeatureFlag(request.params.flagId!);
    await auditSecurityChange(
      request,
      "SECURITY_FEATURE_FLAG_DEACTIVATED",
      "security.FeatureFlags",
      flag.FlagId
    );
    sendSuccess(response, flag);
  })
);

securityRouter.get(
  "/users",
  requirePermission("security", "users.read"),
  asyncHandler(async (request, response) => {
    const users = await enterpriseSecurityService.listUsers(tenantIdFrom(request));
    sendSuccess(response, users);
  })
);

securityRouter.post(
  "/users",
  requirePermission("security", "users.create"),
  validateRequest({ body: createUserSchema }),
  asyncHandler(async (request, response) => {
    const user = await enterpriseSecurityService.createUser({
      tenantId: tenantIdFrom(request),
      ...request.body
    });

    await auditSecurityChange(request, "SECURITY_USER_CREATED", "security.Users", user.UserId);
    sendSuccess(response, user, 201);
  })
);

securityRouter.put(
  "/users/:userId",
  requirePermission("security", "users.update"),
  validateRequest({ params: idParamSchema, body: updateUserSchema }),
  asyncHandler(async (request, response) => {
    const user = await enterpriseSecurityService.updateUser({
      tenantId: tenantIdFrom(request),
      userId: request.params.userId!,
      ...request.body
    });

    await auditSecurityChange(request, "SECURITY_USER_UPDATED", "security.Users", user.UserId);
    sendSuccess(response, user);
  })
);

securityRouter.delete(
  "/users/:userId",
  requirePermission("security", "users.delete"),
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (request, response) => {
    const user = await enterpriseSecurityService.deleteUser(tenantIdFrom(request), request.params.userId!);
    await auditSecurityChange(request, "SECURITY_USER_DEACTIVATED", "security.Users", user.UserId);
    sendSuccess(response, user);
  })
);

securityRouter.get(
  "/roles",
  requirePermission("security", "roles.read"),
  asyncHandler(async (request, response) => {
    const roles = await enterpriseSecurityService.listRoles(tenantIdFrom(request));
    sendSuccess(response, roles);
  })
);

securityRouter.post(
  "/roles",
  requirePermission("security", "roles.create"),
  validateRequest({ body: roleSchema }),
  asyncHandler(async (request, response) => {
    const role = await enterpriseSecurityService.createRole({
      tenantId: tenantIdFrom(request),
      ...request.body
    });

    await auditSecurityChange(request, "SECURITY_ROLE_CREATED", "security.Roles", role.RoleId);
    sendSuccess(response, role, 201);
  })
);

securityRouter.put(
  "/roles/:roleId",
  requirePermission("security", "roles.update"),
  validateRequest({ params: idParamSchema, body: roleSchema }),
  asyncHandler(async (request, response) => {
    const role = await enterpriseSecurityService.updateRole({
      tenantId: tenantIdFrom(request),
      roleId: request.params.roleId!,
      ...request.body
    });

    await auditSecurityChange(request, "SECURITY_ROLE_UPDATED", "security.Roles", role.RoleId);
    sendSuccess(response, role);
  })
);

securityRouter.delete(
  "/roles/:roleId",
  requirePermission("security", "roles.delete"),
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (request, response) => {
    const role = await enterpriseSecurityService.deleteRole(tenantIdFrom(request), request.params.roleId!);
    await auditSecurityChange(request, "SECURITY_ROLE_DEACTIVATED", "security.Roles", role.RoleId);
    sendSuccess(response, role);
  })
);

securityRouter.get(
  "/permissions",
  requirePermission("security", "permissions.read"),
  asyncHandler(async (_request, response) => {
    const permissions = await enterpriseSecurityService.listPermissions();
    sendSuccess(response, permissions);
  })
);

securityRouter.post(
  "/permissions",
  requirePermission("security", "permissions.create"),
  validateRequest({ body: permissionSchema }),
  asyncHandler(async (request, response) => {
    const permission = await enterpriseSecurityService.createPermission(request.body);
    await auditSecurityChange(
      request,
      "SECURITY_PERMISSION_CREATED",
      "security.Permissions",
      permission.PermissionId
    );
    sendSuccess(response, permission, 201);
  })
);

securityRouter.put(
  "/permissions/:permissionId",
  requirePermission("security", "permissions.update"),
  validateRequest({ params: idParamSchema, body: permissionSchema }),
  asyncHandler(async (request, response) => {
    const permission = await enterpriseSecurityService.updatePermission({
      permissionId: request.params.permissionId!,
      ...request.body
    });
    await auditSecurityChange(
      request,
      "SECURITY_PERMISSION_UPDATED",
      "security.Permissions",
      permission.PermissionId
    );
    sendSuccess(response, permission);
  })
);

securityRouter.delete(
  "/permissions/:permissionId",
  requirePermission("security", "permissions.delete"),
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (request, response) => {
    const permission = await enterpriseSecurityService.deletePermission(request.params.permissionId!);
    await auditSecurityChange(
      request,
      "SECURITY_PERMISSION_DEACTIVATED",
      "security.Permissions",
      permission.PermissionId
    );
    sendSuccess(response, permission);
  })
);

securityRouter.get(
  "/modules",
  requirePermission("security", "modules.read"),
  asyncHandler(async (_request, response) => {
    const modules = await enterpriseSecurityService.listModules();
    sendSuccess(response, modules);
  })
);

securityRouter.post(
  "/modules",
  requirePermission("security", "modules.create"),
  validateRequest({ body: catalogSchema }),
  asyncHandler(async (request, response) => {
    const module = await enterpriseSecurityService.createModule(request.body);
    await auditSecurityChange(request, "SECURITY_MODULE_CREATED", "security.Modules", module.ModuleId);
    sendSuccess(response, module, 201);
  })
);

securityRouter.put(
  "/modules/:moduleId",
  requirePermission("security", "modules.update"),
  validateRequest({ params: idParamSchema, body: catalogSchema }),
  asyncHandler(async (request, response) => {
    const module = await enterpriseSecurityService.updateModule({
      moduleId: request.params.moduleId!,
      ...request.body
    });
    await auditSecurityChange(request, "SECURITY_MODULE_UPDATED", "security.Modules", module.ModuleId);
    sendSuccess(response, module);
  })
);

securityRouter.delete(
  "/modules/:moduleId",
  requirePermission("security", "modules.delete"),
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (request, response) => {
    const module = await enterpriseSecurityService.deleteModule(request.params.moduleId!);
    await auditSecurityChange(request, "SECURITY_MODULE_DEACTIVATED", "security.Modules", module.ModuleId);
    sendSuccess(response, module);
  })
);

securityRouter.get(
  "/actions",
  requirePermission("security", "actions.read"),
  asyncHandler(async (_request, response) => {
    const actions = await enterpriseSecurityService.listActions();
    sendSuccess(response, actions);
  })
);

securityRouter.post(
  "/actions",
  requirePermission("security", "actions.create"),
  validateRequest({ body: catalogSchema }),
  asyncHandler(async (request, response) => {
    const action = await enterpriseSecurityService.createAction(request.body);
    await auditSecurityChange(request, "SECURITY_ACTION_CREATED", "security.Actions", action.ActionId);
    sendSuccess(response, action, 201);
  })
);

securityRouter.put(
  "/actions/:actionId",
  requirePermission("security", "actions.update"),
  validateRequest({ params: idParamSchema, body: catalogSchema }),
  asyncHandler(async (request, response) => {
    const action = await enterpriseSecurityService.updateAction({
      actionId: request.params.actionId!,
      ...request.body
    });
    await auditSecurityChange(request, "SECURITY_ACTION_UPDATED", "security.Actions", action.ActionId);
    sendSuccess(response, action);
  })
);

securityRouter.delete(
  "/actions/:actionId",
  requirePermission("security", "actions.delete"),
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (request, response) => {
    const action = await enterpriseSecurityService.deleteAction(request.params.actionId!);
    await auditSecurityChange(request, "SECURITY_ACTION_DEACTIVATED", "security.Actions", action.ActionId);
    sendSuccess(response, action);
  })
);

securityRouter.get(
  "/user-roles",
  requirePermission("security", "user-roles.read"),
  asyncHandler(async (request, response) => {
    const assignments = await enterpriseSecurityService.listUserRoles(tenantIdFrom(request));
    sendSuccess(response, assignments);
  })
);

securityRouter.post(
  "/user-roles",
  requirePermission("security", "user-roles.assign"),
  validateRequest({ body: userRoleSchema }),
  asyncHandler(async (request, response) => {
    const assignment = await enterpriseSecurityService.assignUserRole(
      tenantIdFrom(request),
      request.body.userId,
      request.body.roleId
    );
    await auditSecurityChange(request, "SECURITY_USER_ROLE_ASSIGNED", "security.UserRoles");
    sendSuccess(response, assignment, 201);
  })
);

securityRouter.put(
  "/user-roles",
  requirePermission("security", "user-roles.assign"),
  validateRequest({ body: userRoleSchema }),
  asyncHandler(async (request, response) => {
    const assignment = await enterpriseSecurityService.assignUserRole(
      tenantIdFrom(request),
      request.body.userId,
      request.body.roleId
    );
    await auditSecurityChange(request, "SECURITY_USER_ROLE_ASSIGNED", "security.UserRoles");
    sendSuccess(response, assignment);
  })
);

securityRouter.delete(
  "/user-roles",
  requirePermission("security", "user-roles.remove"),
  validateRequest({ body: userRoleSchema }),
  asyncHandler(async (request, response) => {
    const assignment = await enterpriseSecurityService.removeUserRole(
      tenantIdFrom(request),
      request.body.userId,
      request.body.roleId
    );
    await auditSecurityChange(request, "SECURITY_USER_ROLE_REMOVED", "security.UserRoles");
    sendSuccess(response, assignment);
  })
);

securityRouter.get(
  "/role-permissions",
  requirePermission("security", "role-permissions.read"),
  asyncHandler(async (request, response) => {
    const assignments = await enterpriseSecurityService.listRolePermissions(tenantIdFrom(request));
    sendSuccess(response, assignments);
  })
);

securityRouter.post(
  "/role-permissions",
  requirePermission("security", "role-permissions.assign"),
  validateRequest({ body: rolePermissionSchema }),
  asyncHandler(async (request, response) => {
    const assignment = await enterpriseSecurityService.assignRolePermission(
      tenantIdFrom(request),
      request.body.roleId,
      request.body.permissionId
    );
    await auditSecurityChange(request, "SECURITY_ROLE_PERMISSION_ASSIGNED", "security.RolePermissions");
    sendSuccess(response, assignment, 201);
  })
);

securityRouter.put(
  "/role-permissions",
  requirePermission("security", "role-permissions.assign"),
  validateRequest({ body: rolePermissionSchema }),
  asyncHandler(async (request, response) => {
    const assignment = await enterpriseSecurityService.assignRolePermission(
      tenantIdFrom(request),
      request.body.roleId,
      request.body.permissionId
    );
    await auditSecurityChange(request, "SECURITY_ROLE_PERMISSION_ASSIGNED", "security.RolePermissions");
    sendSuccess(response, assignment);
  })
);

securityRouter.delete(
  "/role-permissions",
  requirePermission("security", "role-permissions.remove"),
  validateRequest({ body: rolePermissionSchema }),
  asyncHandler(async (request, response) => {
    const assignment = await enterpriseSecurityService.removeRolePermission(
      tenantIdFrom(request),
      request.body.roleId,
      request.body.permissionId
    );
    await auditSecurityChange(request, "SECURITY_ROLE_PERMISSION_REMOVED", "security.RolePermissions");
    sendSuccess(response, assignment);
  })
);
