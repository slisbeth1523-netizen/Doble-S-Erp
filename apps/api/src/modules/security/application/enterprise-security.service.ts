import bcrypt from "bcryptjs";

import { BaseService } from "../../../services/BaseService.js";
import { logger } from "../../../utils/logger.js";
import {
  enterpriseSecurityRepository,
  type CatalogInput,
  type PermissionInput,
  type RoleInput,
  type UpdateUserInput
} from "../infrastructure/enterprise-security.repository.js";

const passwordSaltRounds = 12;

export class EnterpriseSecurityService extends BaseService {
  listUsers(tenantId: string) {
    return enterpriseSecurityRepository.listUsers(tenantId);
  }

  async createUser(input: {
    tenantId: string;
    defaultCompanyId?: string;
    email: string;
    displayName: string;
    password: string;
  }) {
    const passwordHash = await bcrypt.hash(input.password, passwordSaltRounds);
    const user = await enterpriseSecurityRepository.createUser({
      tenantId: input.tenantId,
      defaultCompanyId: input.defaultCompanyId,
      email: input.email,
      displayName: input.displayName,
      passwordHash
    });

    logger.info("Security user created", { tenantId: input.tenantId, userId: user.UserId });
    return user;
  }

  async updateUser(input: UpdateUserInput) {
    const user = await enterpriseSecurityRepository.updateUser(input);
    logger.info("Security user updated", { tenantId: input.tenantId, userId: input.userId });
    return this.ensureFound(user, "User not found");
  }

  async deleteUser(tenantId: string, userId: string) {
    const user = await enterpriseSecurityRepository.deleteUser(tenantId, userId);
    logger.info("Security user deactivated", { tenantId, userId });
    return this.ensureFound(user, "User not found");
  }

  listRoles(tenantId: string) {
    return enterpriseSecurityRepository.listRoles(tenantId);
  }

  async createRole(input: RoleInput) {
    const role = await enterpriseSecurityRepository.createRole(input);
    logger.info("Security role created", { tenantId: input.tenantId, roleId: role.RoleId });
    return role;
  }

  async updateRole(input: RoleInput & { roleId: string }) {
    const role = await enterpriseSecurityRepository.updateRole(input);
    logger.info("Security role updated", { tenantId: input.tenantId, roleId: input.roleId });
    return this.ensureFound(role, "Role not found");
  }

  async deleteRole(tenantId: string, roleId: string) {
    const role = await enterpriseSecurityRepository.deleteRole(tenantId, roleId);
    logger.info("Security role deactivated", { tenantId, roleId });
    return this.ensureFound(role, "Role not found or system role cannot be deleted");
  }

  listPermissions() {
    return enterpriseSecurityRepository.listPermissions();
  }

  async createPermission(input: PermissionInput) {
    const permission = await enterpriseSecurityRepository.createPermission(input);
    logger.info("Security permission created", { permissionId: permission.PermissionId });
    return permission;
  }

  async updatePermission(input: PermissionInput & { permissionId: string }) {
    const permission = await enterpriseSecurityRepository.updatePermission(input);
    logger.info("Security permission updated", { permissionId: input.permissionId });
    return this.ensureFound(permission, "Permission not found");
  }

  async deletePermission(permissionId: string) {
    const permission = await enterpriseSecurityRepository.deletePermission(permissionId);
    logger.info("Security permission deactivated", { permissionId });
    return this.ensureFound(permission, "Permission not found");
  }

  listModules() {
    return enterpriseSecurityRepository.listModules();
  }

  async createModule(input: CatalogInput) {
    const module = await enterpriseSecurityRepository.createModule(input);
    logger.info("Security module created", { moduleId: module.ModuleId });
    return module;
  }

  async updateModule(input: CatalogInput & { moduleId: string }) {
    const module = await enterpriseSecurityRepository.updateModule(input);
    logger.info("Security module updated", { moduleId: input.moduleId });
    return this.ensureFound(module, "Module not found");
  }

  async deleteModule(moduleId: string) {
    const module = await enterpriseSecurityRepository.deleteModule(moduleId);
    logger.info("Security module deactivated", { moduleId });
    return this.ensureFound(module, "Module not found");
  }

  listActions() {
    return enterpriseSecurityRepository.listActions();
  }

  async createAction(input: CatalogInput) {
    const action = await enterpriseSecurityRepository.createAction(input);
    logger.info("Security action created", { actionId: action.ActionId });
    return action;
  }

  async updateAction(input: CatalogInput & { actionId: string }) {
    const action = await enterpriseSecurityRepository.updateAction(input);
    logger.info("Security action updated", { actionId: input.actionId });
    return this.ensureFound(action, "Action not found");
  }

  async deleteAction(actionId: string) {
    const action = await enterpriseSecurityRepository.deleteAction(actionId);
    logger.info("Security action deactivated", { actionId });
    return this.ensureFound(action, "Action not found");
  }

  listUserRoles(tenantId: string) {
    return enterpriseSecurityRepository.listUserRoles(tenantId);
  }

  assignUserRole(tenantId: string, userId: string, roleId: string) {
    logger.info("Security user role assigned", { tenantId, userId, roleId });
    return enterpriseSecurityRepository.assignUserRole(tenantId, userId, roleId);
  }

  async removeUserRole(tenantId: string, userId: string, roleId: string) {
    const assignment = await enterpriseSecurityRepository.removeUserRole(tenantId, userId, roleId);
    logger.info("Security user role removed", { tenantId, userId, roleId });
    return this.ensureFound(assignment, "User role assignment not found");
  }

  listRolePermissions(tenantId: string) {
    return enterpriseSecurityRepository.listRolePermissions(tenantId);
  }

  assignRolePermission(tenantId: string, roleId: string, permissionId: string) {
    logger.info("Security role permission assigned", { tenantId, roleId, permissionId });
    return enterpriseSecurityRepository.assignRolePermission(tenantId, roleId, permissionId);
  }

  async removeRolePermission(tenantId: string, roleId: string, permissionId: string) {
    const assignment = await enterpriseSecurityRepository.removeRolePermission(
      tenantId,
      roleId,
      permissionId
    );
    logger.info("Security role permission removed", { tenantId, roleId, permissionId });
    return this.ensureFound(assignment, "Role permission assignment not found");
  }
}

export const enterpriseSecurityService = new EnterpriseSecurityService();
