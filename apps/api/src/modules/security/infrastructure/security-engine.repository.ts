import { BaseSqlRepository } from "../../../repositories/BaseSqlRepository.js";

export type NavigationInput = {
  tenantId?: string | null;
  moduleId?: string | null;
  parentNavigationId?: string | null;
  label: string;
  route?: string | null;
  icon?: string | null;
  displayOrder: number;
  isVisible: boolean;
  isActive: boolean;
  requiredPermissionCode?: string | null;
};

export type PolicyInput = {
  code: string;
  name: string;
  description?: string | null;
  scopeCode: "OWN_RECORDS" | "BRANCH_ONLY" | "COMPANY_ONLY" | "TENANT_WIDE";
  isActive: boolean;
};

export type ModuleLicenseInput = {
  tenantId: string;
  moduleId: string;
  startsAt?: string | null;
  expiresAt?: string | null;
};

export type FeatureFlagInput = {
  code: string;
  name: string;
  description?: string | null;
  isEnabled: boolean;
  isActive: boolean;
};

type NavigationRow = Record<string, unknown> & { NavigationId: string };
type PolicyRow = Record<string, unknown> & { PolicyId: string };
type LicenseRow = Record<string, unknown> & { LicenseId: string };
type FeatureFlagRow = Record<string, unknown> & { FlagId: string; Code?: string };
type ContextRow = Record<string, unknown>;

export class SecurityEngineRepository extends BaseSqlRepository {
  listNavigation(tenantId: string) {
    return this.query<NavigationRow>(
      `
        SELECT
          n.NavigationId,
          n.TenantId,
          n.ModuleId,
          m.Code AS ModuleCode,
          n.ParentNavigationId,
          n.Label,
          n.Route,
          n.Icon,
          n.DisplayOrder,
          n.IsVisible,
          n.IsActive,
          n.RequiredPermissionCode,
          n.CreatedAt,
          n.UpdatedAt
        FROM security.NavigationItems n
        LEFT JOIN security.Modules m ON m.ModuleId = n.ModuleId
        WHERE (n.TenantId IS NULL OR n.TenantId = @TenantId)
        ORDER BY n.DisplayOrder, n.Label
      `,
      [{ name: "TenantId", value: tenantId }]
    );
  }

  async createNavigation(input: NavigationInput) {
    const result = await this.query<NavigationRow>(
      `
        INSERT INTO security.NavigationItems (
          TenantId,
          ModuleId,
          ParentNavigationId,
          Label,
          Route,
          Icon,
          DisplayOrder,
          IsVisible,
          IsActive,
          RequiredPermissionCode
        )
        OUTPUT inserted.*
        VALUES (
          @TenantId,
          @ModuleId,
          @ParentNavigationId,
          @Label,
          @Route,
          @Icon,
          @DisplayOrder,
          @IsVisible,
          @IsActive,
          @RequiredPermissionCode
        )
      `,
      [
        { name: "TenantId", value: input.tenantId ?? null },
        { name: "ModuleId", value: input.moduleId ?? null },
        { name: "ParentNavigationId", value: input.parentNavigationId ?? null },
        { name: "Label", value: input.label },
        { name: "Route", value: input.route ?? null },
        { name: "Icon", value: input.icon ?? null },
        { name: "DisplayOrder", value: input.displayOrder },
        { name: "IsVisible", value: input.isVisible },
        { name: "IsActive", value: input.isActive },
        { name: "RequiredPermissionCode", value: input.requiredPermissionCode ?? null }
      ]
    );

    return result[0];
  }

  async updateNavigation(input: NavigationInput & { navigationId: string }) {
    const result = await this.query<NavigationRow>(
      `
        UPDATE security.NavigationItems
        SET
          TenantId = @TenantId,
          ModuleId = @ModuleId,
          ParentNavigationId = @ParentNavigationId,
          Label = @Label,
          Route = @Route,
          Icon = @Icon,
          DisplayOrder = @DisplayOrder,
          IsVisible = @IsVisible,
          IsActive = @IsActive,
          RequiredPermissionCode = @RequiredPermissionCode,
          UpdatedAt = SYSUTCDATETIME()
        OUTPUT inserted.*
        WHERE NavigationId = @NavigationId
      `,
      [
        { name: "NavigationId", value: input.navigationId },
        { name: "TenantId", value: input.tenantId ?? null },
        { name: "ModuleId", value: input.moduleId ?? null },
        { name: "ParentNavigationId", value: input.parentNavigationId ?? null },
        { name: "Label", value: input.label },
        { name: "Route", value: input.route ?? null },
        { name: "Icon", value: input.icon ?? null },
        { name: "DisplayOrder", value: input.displayOrder },
        { name: "IsVisible", value: input.isVisible },
        { name: "IsActive", value: input.isActive },
        { name: "RequiredPermissionCode", value: input.requiredPermissionCode ?? null }
      ]
    );

    return result[0];
  }

  async deleteNavigation(navigationId: string) {
    const result = await this.query<NavigationRow>(
      `
        UPDATE security.NavigationItems
        SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
        OUTPUT inserted.*
        WHERE NavigationId = @NavigationId
      `,
      [{ name: "NavigationId", value: navigationId }]
    );

    return result[0];
  }

  listPolicies() {
    return this.query<PolicyRow>(`
      SELECT PolicyId, Code, Name, Description, ScopeCode, IsActive, CreatedAt, UpdatedAt
      FROM security.AccessPolicies
      ORDER BY Name
    `);
  }

  async createPolicy(input: PolicyInput) {
    const result = await this.query<PolicyRow>(
      `
        INSERT INTO security.AccessPolicies (Code, Name, Description, ScopeCode, IsActive)
        OUTPUT inserted.*
        VALUES (@Code, @Name, @Description, @ScopeCode, @IsActive)
      `,
      [
        { name: "Code", value: input.code },
        { name: "Name", value: input.name },
        { name: "Description", value: input.description ?? null },
        { name: "ScopeCode", value: input.scopeCode },
        { name: "IsActive", value: input.isActive }
      ]
    );

    return result[0];
  }

  async updatePolicy(input: PolicyInput & { policyId: string }) {
    const result = await this.query<PolicyRow>(
      `
        UPDATE security.AccessPolicies
        SET Code = @Code, Name = @Name, Description = @Description, ScopeCode = @ScopeCode, IsActive = @IsActive, UpdatedAt = SYSUTCDATETIME()
        OUTPUT inserted.*
        WHERE PolicyId = @PolicyId
      `,
      [
        { name: "PolicyId", value: input.policyId },
        { name: "Code", value: input.code },
        { name: "Name", value: input.name },
        { name: "Description", value: input.description ?? null },
        { name: "ScopeCode", value: input.scopeCode },
        { name: "IsActive", value: input.isActive }
      ]
    );

    return result[0];
  }

  async deletePolicy(policyId: string) {
    const result = await this.query<PolicyRow>(
      `
        UPDATE security.AccessPolicies
        SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
        OUTPUT inserted.*
        WHERE PolicyId = @PolicyId
      `,
      [{ name: "PolicyId", value: policyId }]
    );

    return result[0];
  }

  listModuleLicenses(tenantId: string) {
    return this.query<LicenseRow>(
      `
        SELECT
          l.LicenseId,
          l.TenantId,
          l.ModuleId,
          m.Code AS ModuleCode,
          m.Name AS ModuleName,
          l.IsActive,
          l.StartsAt,
          l.ExpiresAt,
          l.CreatedAt,
          l.UpdatedAt
        FROM security.TenantModuleLicenses l
        INNER JOIN security.Modules m ON m.ModuleId = l.ModuleId
        WHERE l.TenantId = @TenantId
        ORDER BY m.Name
      `,
      [{ name: "TenantId", value: tenantId }]
    );
  }

  async createModuleLicense(input: ModuleLicenseInput) {
    const result = await this.query<LicenseRow>(
      `
        MERGE security.TenantModuleLicenses AS target
        USING (
          SELECT @TenantId AS TenantId, @ModuleId AS ModuleId
        ) AS source
        ON target.TenantId = source.TenantId AND target.ModuleId = source.ModuleId
        WHEN MATCHED THEN
          UPDATE SET IsActive = 1, StartsAt = @StartsAt, ExpiresAt = @ExpiresAt, UpdatedAt = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (TenantId, ModuleId, StartsAt, ExpiresAt, IsActive)
          VALUES (@TenantId, @ModuleId, @StartsAt, @ExpiresAt, 1)
        OUTPUT inserted.*;
      `,
      [
        { name: "TenantId", value: input.tenantId },
        { name: "ModuleId", value: input.moduleId },
        { name: "StartsAt", value: input.startsAt ?? null },
        { name: "ExpiresAt", value: input.expiresAt ?? null }
      ]
    );

    return result[0];
  }

  async deleteModuleLicense(tenantId: string, licenseId: string) {
    const result = await this.query<LicenseRow>(
      `
        UPDATE security.TenantModuleLicenses
        SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
        OUTPUT inserted.*
        WHERE TenantId = @TenantId AND LicenseId = @LicenseId
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "LicenseId", value: licenseId }
      ]
    );

    return result[0];
  }

  async isModuleLicensed(tenantId: string, moduleCode: string) {
    const result = await this.query<{ IsLicensed: number }>(
      `
        SELECT TOP 1 1 AS IsLicensed
        FROM security.TenantModuleLicenses l
        INNER JOIN security.Modules m ON m.ModuleId = l.ModuleId
        WHERE l.TenantId = @TenantId
          AND m.Code = @ModuleCode
          AND l.IsActive = 1
          AND m.IsActive = 1
          AND (l.StartsAt IS NULL OR l.StartsAt <= SYSUTCDATETIME())
          AND (l.ExpiresAt IS NULL OR l.ExpiresAt >= SYSUTCDATETIME())
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "ModuleCode", value: moduleCode }
      ]
    );

    return result.length > 0;
  }

  listFeatureFlags(tenantId: string) {
    return this.query<FeatureFlagRow>(
      `
        SELECT
          f.FlagId,
          f.Code,
          f.Name,
          f.Description,
          f.IsEnabled AS GlobalIsEnabled,
          f.IsActive,
          tf.TenantFeatureFlagId,
          tf.IsEnabled AS TenantIsEnabled,
          f.CreatedAt,
          f.UpdatedAt
        FROM security.FeatureFlags f
        LEFT JOIN security.TenantFeatureFlags tf ON tf.FlagId = f.FlagId AND tf.TenantId = @TenantId
        ORDER BY f.Code
      `,
      [{ name: "TenantId", value: tenantId }]
    );
  }

  async createFeatureFlag(input: FeatureFlagInput) {
    const result = await this.query<FeatureFlagRow>(
      `
        INSERT INTO security.FeatureFlags (Code, Name, Description, IsEnabled, IsActive)
        OUTPUT inserted.*
        VALUES (@Code, @Name, @Description, @IsEnabled, @IsActive)
      `,
      [
        { name: "Code", value: input.code },
        { name: "Name", value: input.name },
        { name: "Description", value: input.description ?? null },
        { name: "IsEnabled", value: input.isEnabled },
        { name: "IsActive", value: input.isActive }
      ]
    );

    return result[0];
  }

  async updateFeatureFlag(input: FeatureFlagInput & { flagId: string }) {
    const result = await this.query<FeatureFlagRow>(
      `
        UPDATE security.FeatureFlags
        SET Code = @Code, Name = @Name, Description = @Description, IsEnabled = @IsEnabled, IsActive = @IsActive, UpdatedAt = SYSUTCDATETIME()
        OUTPUT inserted.*
        WHERE FlagId = @FlagId
      `,
      [
        { name: "FlagId", value: input.flagId },
        { name: "Code", value: input.code },
        { name: "Name", value: input.name },
        { name: "Description", value: input.description ?? null },
        { name: "IsEnabled", value: input.isEnabled },
        { name: "IsActive", value: input.isActive }
      ]
    );

    return result[0];
  }

  async deleteFeatureFlag(flagId: string) {
    const result = await this.query<FeatureFlagRow>(
      `
        UPDATE security.FeatureFlags
        SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
        OUTPUT inserted.*
        WHERE FlagId = @FlagId
      `,
      [{ name: "FlagId", value: flagId }]
    );

    return result[0];
  }

  async isFeatureFlagEnabled(tenantId: string, flagCode: string) {
    const result = await this.query<{ IsEnabled: boolean }>(
      `
        SELECT TOP 1
          CAST(COALESCE(tf.IsEnabled, f.IsEnabled) AS bit) AS IsEnabled
        FROM security.FeatureFlags f
        LEFT JOIN security.TenantFeatureFlags tf ON tf.FlagId = f.FlagId AND tf.TenantId = @TenantId
        WHERE f.Code = @FlagCode
          AND f.IsActive = 1
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "FlagCode", value: flagCode }
      ]
    );

    return result[0]?.IsEnabled === true;
  }

  listUserRoles(tenantId: string, userId: string) {
    return this.query<ContextRow>(
      `
        SELECT r.RoleId, r.Code, r.Name
        FROM security.UserRoles ur
        INNER JOIN security.Roles r ON r.RoleId = ur.RoleId AND r.TenantId = ur.TenantId
        WHERE ur.TenantId = @TenantId
          AND ur.UserId = @UserId
          AND ISNULL(r.IsActive, 1) = 1
        ORDER BY r.Name
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "UserId", value: userId }
      ]
    );
  }

  listUserPermissions(tenantId: string, userId: string) {
    return this.query<ContextRow>(
      `
        SELECT DISTINCT
          p.PermissionId,
          p.ModuleCode,
          p.ActionCode,
          CONCAT(p.ModuleCode, '.', p.ActionCode) AS PermissionCode,
          p.Description
        FROM security.UserRoles ur
        INNER JOIN security.RolePermissions rp ON rp.RoleId = ur.RoleId AND rp.TenantId = ur.TenantId
        INNER JOIN security.Permissions p ON p.PermissionId = rp.PermissionId
        WHERE ur.TenantId = @TenantId
          AND ur.UserId = @UserId
          AND ISNULL(p.IsActive, 1) = 1
        ORDER BY p.ModuleCode, p.ActionCode
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "UserId", value: userId }
      ]
    );
  }
}

export const securityEngineRepository = new SecurityEngineRepository();
