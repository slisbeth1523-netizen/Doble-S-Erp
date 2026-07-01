import { BaseService } from "../../../services/BaseService.js";
import { logger } from "../../../utils/logger.js";
import {
  securityEngineRepository,
  type FeatureFlagInput,
  type ModuleLicenseInput,
  type NavigationInput,
  type PolicyInput
} from "../infrastructure/security-engine.repository.js";

export class SecurityEngineService extends BaseService {
  listNavigation(tenantId: string) {
    return securityEngineRepository.listNavigation(tenantId);
  }

  async createNavigation(input: NavigationInput) {
    const navigation = await securityEngineRepository.createNavigation(input);
    logger.info("Security navigation created", { navigationId: navigation.NavigationId });
    return navigation;
  }

  async updateNavigation(input: NavigationInput & { navigationId: string }) {
    const navigation = await securityEngineRepository.updateNavigation(input);
    logger.info("Security navigation updated", { navigationId: input.navigationId });
    return this.ensureFound(navigation, "Navigation item not found");
  }

  async deleteNavigation(navigationId: string) {
    const navigation = await securityEngineRepository.deleteNavigation(navigationId);
    logger.info("Security navigation deactivated", { navigationId });
    return this.ensureFound(navigation, "Navigation item not found");
  }

  listPolicies() {
    return securityEngineRepository.listPolicies();
  }

  async createPolicy(input: PolicyInput) {
    const policy = await securityEngineRepository.createPolicy(input);
    logger.info("Security policy created", { policyId: policy.PolicyId });
    return policy;
  }

  async updatePolicy(input: PolicyInput & { policyId: string }) {
    const policy = await securityEngineRepository.updatePolicy(input);
    logger.info("Security policy updated", { policyId: input.policyId });
    return this.ensureFound(policy, "Access policy not found");
  }

  async deletePolicy(policyId: string) {
    const policy = await securityEngineRepository.deletePolicy(policyId);
    logger.info("Security policy deactivated", { policyId });
    return this.ensureFound(policy, "Access policy not found");
  }

  listModuleLicenses(tenantId: string) {
    return securityEngineRepository.listModuleLicenses(tenantId);
  }

  async createModuleLicense(input: ModuleLicenseInput) {
    const license = await securityEngineRepository.createModuleLicense(input);
    logger.info("Security module license assigned", {
      tenantId: input.tenantId,
      moduleId: input.moduleId
    });
    return license;
  }

  async deleteModuleLicense(tenantId: string, licenseId: string) {
    const license = await securityEngineRepository.deleteModuleLicense(tenantId, licenseId);
    logger.info("Security module license revoked", { tenantId, licenseId });
    return this.ensureFound(license, "Module license not found");
  }

  isModuleLicensed(tenantId: string, moduleCode: string) {
    return securityEngineRepository.isModuleLicensed(tenantId, moduleCode);
  }

  listFeatureFlags(tenantId: string) {
    return securityEngineRepository.listFeatureFlags(tenantId);
  }

  async createFeatureFlag(input: FeatureFlagInput) {
    const flag = await securityEngineRepository.createFeatureFlag(input);
    logger.info("Security feature flag created", { flagId: flag.FlagId, code: flag.Code });
    return flag;
  }

  async updateFeatureFlag(input: FeatureFlagInput & { flagId: string }) {
    const flag = await securityEngineRepository.updateFeatureFlag(input);
    logger.info("Security feature flag updated", { flagId: input.flagId });
    return this.ensureFound(flag, "Feature flag not found");
  }

  async deleteFeatureFlag(flagId: string) {
    const flag = await securityEngineRepository.deleteFeatureFlag(flagId);
    logger.info("Security feature flag deactivated", { flagId });
    return this.ensureFound(flag, "Feature flag not found");
  }

  isFeatureFlagEnabled(tenantId: string, flagCode: string) {
    return securityEngineRepository.isFeatureFlagEnabled(tenantId, flagCode);
  }

  async getUserContext(input: {
    tenantId: string;
    userId: string;
    companyId?: string;
    user: unknown;
  }) {
    const [roles, permissions, licensedModules, featureFlags, navigation] = await Promise.all([
      securityEngineRepository.listUserRoles(input.tenantId, input.userId),
      securityEngineRepository.listUserPermissions(input.tenantId, input.userId),
      securityEngineRepository.listModuleLicenses(input.tenantId),
      securityEngineRepository.listFeatureFlags(input.tenantId),
      securityEngineRepository.listNavigation(input.tenantId)
    ]);

    const permissionCodes = new Set(
      permissions
        .map((permission) => permission.PermissionCode)
        .filter((permissionCode): permissionCode is string => typeof permissionCode === "string")
    );

    const allowedMenu = navigation.filter((item) => {
      if (item.IsActive === false || item.IsVisible === false) {
        return false;
      }

      if (typeof item.RequiredPermissionCode !== "string" || !item.RequiredPermissionCode) {
        return true;
      }

      return permissionCodes.has(item.RequiredPermissionCode);
    });

    return {
      user: input.user,
      tenant: {
        tenantId: input.tenantId
      },
      company: input.companyId ? { companyId: input.companyId } : null,
      roles,
      permissions,
      licensedModules: licensedModules.filter((license) => license.IsActive !== false),
      featureFlags: featureFlags.filter((flag) => flag.IsActive !== false),
      menu: allowedMenu,
      allowedActions: permissions
    };
  }
}

export const securityEngineService = new SecurityEngineService();
