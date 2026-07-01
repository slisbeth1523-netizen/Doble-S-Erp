import { BaseSqlRepository } from "../../../repositories/BaseSqlRepository.js";

export type CreateUserInput = {
  tenantId: string;
  defaultCompanyId?: string;
  email: string;
  displayName: string;
  passwordHash: string;
};

export type UpdateUserInput = {
  tenantId: string;
  userId: string;
  defaultCompanyId?: string | null;
  email: string;
  displayName: string;
  isActive: boolean;
};

export type RoleInput = {
  tenantId: string;
  code: string;
  name: string;
  isActive?: boolean;
};

export type PermissionInput = {
  moduleCode: string;
  actionCode: string;
  description?: string | null;
  isActive?: boolean;
};

export type CatalogInput = {
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
};

type UserRow = Record<string, unknown> & { UserId: string };
type RoleRow = Record<string, unknown> & { RoleId: string };
type PermissionRow = Record<string, unknown> & { PermissionId: string };
type ModuleRow = Record<string, unknown> & { ModuleId: string };
type ActionRow = Record<string, unknown> & { ActionId: string };
type AssignmentRow = Record<string, unknown>;

export class EnterpriseSecurityRepository extends BaseSqlRepository {
  listUsers(tenantId: string) {
    return this.query(
      `
        SELECT
          UserId,
          TenantId,
          DefaultCompanyId,
          Email,
          DisplayName,
          IsActive,
          LastLoginAt,
          CreatedAt,
          UpdatedAt
        FROM security.Users
        WHERE TenantId = @TenantId
        ORDER BY DisplayName
      `,
      [{ name: "TenantId", value: tenantId }]
    );
  }

  findUserById(tenantId: string, userId: string) {
    return this.query(
      `
        SELECT TOP 1
          UserId,
          TenantId,
          DefaultCompanyId,
          Email,
          DisplayName,
          IsActive,
          LastLoginAt,
          CreatedAt,
          UpdatedAt
        FROM security.Users
        WHERE TenantId = @TenantId
          AND UserId = @UserId
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "UserId", value: userId }
      ]
    );
  }

  async createUser(input: CreateUserInput) {
    return this.executeInTransaction(async (transaction) => {
      const request = transaction
        .request()
        .input("TenantId", input.tenantId)
        .input("DefaultCompanyId", input.defaultCompanyId ?? null)
        .input("Email", input.email)
        .input("DisplayName", input.displayName)
        .input("PasswordHash", input.passwordHash);

      const result = await request.query<UserRow>(`
        INSERT INTO security.Users (
          TenantId,
          DefaultCompanyId,
          Email,
          DisplayName,
          PasswordHash
        )
        OUTPUT
          inserted.UserId,
          inserted.TenantId,
          inserted.DefaultCompanyId,
          inserted.Email,
          inserted.DisplayName,
          inserted.IsActive,
          inserted.CreatedAt,
          inserted.UpdatedAt
        VALUES (
          @TenantId,
          @DefaultCompanyId,
          @Email,
          @DisplayName,
          @PasswordHash
        )
      `);

      const user = result.recordset[0];

      if (input.defaultCompanyId) {
        await transaction
          .request()
          .input("TenantId", input.tenantId)
          .input("UserId", user.UserId)
          .input("CompanyId", input.defaultCompanyId)
          .query(`
            IF NOT EXISTS (
              SELECT 1
              FROM security.UserCompanyAccess
              WHERE TenantId = @TenantId
                AND UserId = @UserId
                AND CompanyId = @CompanyId
            )
            BEGIN
              INSERT INTO security.UserCompanyAccess (
                TenantId,
                UserId,
                CompanyId,
                IsDefault
              )
              VALUES (
                @TenantId,
                @UserId,
                @CompanyId,
                1
              );
            END
          `);
      }

      return user;
    });
  }

  async updateUser(input: UpdateUserInput) {
    const result = await this.query<UserRow>(
      `
        UPDATE security.Users
        SET
          DefaultCompanyId = @DefaultCompanyId,
          Email = @Email,
          DisplayName = @DisplayName,
          IsActive = @IsActive,
          UpdatedAt = SYSUTCDATETIME()
        OUTPUT
          inserted.UserId,
          inserted.TenantId,
          inserted.DefaultCompanyId,
          inserted.Email,
          inserted.DisplayName,
          inserted.IsActive,
          inserted.LastLoginAt,
          inserted.CreatedAt,
          inserted.UpdatedAt
        WHERE TenantId = @TenantId
          AND UserId = @UserId
      `,
      [
        { name: "TenantId", value: input.tenantId },
        { name: "UserId", value: input.userId },
        { name: "DefaultCompanyId", value: input.defaultCompanyId ?? null },
        { name: "Email", value: input.email },
        { name: "DisplayName", value: input.displayName },
        { name: "IsActive", value: input.isActive }
      ]
    );

    return result[0];
  }

  async deleteUser(tenantId: string, userId: string) {
    const result = await this.query<UserRow>(
      `
        UPDATE security.Users
        SET
          IsActive = 0,
          UpdatedAt = SYSUTCDATETIME()
        OUTPUT inserted.UserId
        WHERE TenantId = @TenantId
          AND UserId = @UserId
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "UserId", value: userId }
      ]
    );

    return result[0];
  }

  listRoles(tenantId: string) {
    return this.query(
      `
        SELECT
          RoleId,
          TenantId,
          Code,
          Name,
          IsSystemRole,
          IsActive,
          CreatedAt,
          UpdatedAt
        FROM security.Roles
        WHERE TenantId = @TenantId
        ORDER BY Name
      `,
      [{ name: "TenantId", value: tenantId }]
    );
  }

  async createRole(input: RoleInput) {
    const result = await this.query<RoleRow>(
      `
        INSERT INTO security.Roles (
          TenantId,
          Code,
          Name,
          IsActive
        )
        OUTPUT
          inserted.RoleId,
          inserted.TenantId,
          inserted.Code,
          inserted.Name,
          inserted.IsSystemRole,
          inserted.IsActive,
          inserted.CreatedAt,
          inserted.UpdatedAt
        VALUES (
          @TenantId,
          @Code,
          @Name,
          @IsActive
        )
      `,
      [
        { name: "TenantId", value: input.tenantId },
        { name: "Code", value: input.code },
        { name: "Name", value: input.name },
        { name: "IsActive", value: input.isActive ?? true }
      ]
    );

    return result[0];
  }

  async updateRole(input: RoleInput & { roleId: string }) {
    const result = await this.query<RoleRow>(
      `
        UPDATE security.Roles
        SET
          Code = @Code,
          Name = @Name,
          IsActive = @IsActive,
          UpdatedAt = SYSUTCDATETIME()
        OUTPUT
          inserted.RoleId,
          inserted.TenantId,
          inserted.Code,
          inserted.Name,
          inserted.IsSystemRole,
          inserted.IsActive,
          inserted.CreatedAt,
          inserted.UpdatedAt
        WHERE TenantId = @TenantId
          AND RoleId = @RoleId
      `,
      [
        { name: "TenantId", value: input.tenantId },
        { name: "RoleId", value: input.roleId },
        { name: "Code", value: input.code },
        { name: "Name", value: input.name },
        { name: "IsActive", value: input.isActive ?? true }
      ]
    );

    return result[0];
  }

  async deleteRole(tenantId: string, roleId: string) {
    const result = await this.query<RoleRow>(
      `
        UPDATE security.Roles
        SET
          IsActive = 0,
          UpdatedAt = SYSUTCDATETIME()
        OUTPUT inserted.RoleId
        WHERE TenantId = @TenantId
          AND RoleId = @RoleId
          AND IsSystemRole = 0
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "RoleId", value: roleId }
      ]
    );

    return result[0];
  }

  listPermissions() {
    return this.query<PermissionRow>(`
      SELECT
        PermissionId,
        ModuleCode,
        ActionCode,
        Description,
        IsActive,
        CreatedAt,
        UpdatedAt
      FROM security.Permissions
      ORDER BY ModuleCode, ActionCode
    `);
  }

  async createPermission(input: PermissionInput) {
    const result = await this.query<PermissionRow>(
      `
        INSERT INTO security.Permissions (
          ModuleCode,
          ActionCode,
          Description,
          IsActive
        )
        OUTPUT
          inserted.PermissionId,
          inserted.ModuleCode,
          inserted.ActionCode,
          inserted.Description,
          inserted.IsActive,
          inserted.CreatedAt,
          inserted.UpdatedAt
        VALUES (
          @ModuleCode,
          @ActionCode,
          @Description,
          @IsActive
        )
      `,
      [
        { name: "ModuleCode", value: input.moduleCode },
        { name: "ActionCode", value: input.actionCode },
        { name: "Description", value: input.description ?? null },
        { name: "IsActive", value: input.isActive ?? true }
      ]
    );

    return result[0];
  }

  async updatePermission(input: PermissionInput & { permissionId: string }) {
    const result = await this.query<PermissionRow>(
      `
        UPDATE security.Permissions
        SET
          ModuleCode = @ModuleCode,
          ActionCode = @ActionCode,
          Description = @Description,
          IsActive = @IsActive,
          UpdatedAt = SYSUTCDATETIME()
        OUTPUT
          inserted.PermissionId,
          inserted.ModuleCode,
          inserted.ActionCode,
          inserted.Description,
          inserted.IsActive,
          inserted.CreatedAt,
          inserted.UpdatedAt
        WHERE PermissionId = @PermissionId
      `,
      [
        { name: "PermissionId", value: input.permissionId },
        { name: "ModuleCode", value: input.moduleCode },
        { name: "ActionCode", value: input.actionCode },
        { name: "Description", value: input.description ?? null },
        { name: "IsActive", value: input.isActive ?? true }
      ]
    );

    return result[0];
  }

  async deletePermission(permissionId: string) {
    const result = await this.query<PermissionRow>(
      `
        UPDATE security.Permissions
        SET
          IsActive = 0,
          UpdatedAt = SYSUTCDATETIME()
        OUTPUT inserted.PermissionId
        WHERE PermissionId = @PermissionId
      `,
      [{ name: "PermissionId", value: permissionId }]
    );

    return result[0];
  }

  listModules() {
    return this.query<ModuleRow>(`
      SELECT ModuleId, Code, Name, Description, IsActive, CreatedAt, UpdatedAt
      FROM security.Modules
      ORDER BY Name
    `);
  }

  async createModule(input: CatalogInput) {
    const result = await this.query<ModuleRow>(
      `
        INSERT INTO security.Modules (Code, Name, Description, IsActive)
        OUTPUT inserted.ModuleId, inserted.Code, inserted.Name, inserted.Description, inserted.IsActive, inserted.CreatedAt, inserted.UpdatedAt
        VALUES (@Code, @Name, @Description, @IsActive)
      `,
      [
        { name: "Code", value: input.code },
        { name: "Name", value: input.name },
        { name: "Description", value: input.description ?? null },
        { name: "IsActive", value: input.isActive ?? true }
      ]
    );

    return result[0];
  }

  async updateModule(input: CatalogInput & { moduleId: string }) {
    const result = await this.query<ModuleRow>(
      `
        UPDATE security.Modules
        SET Code = @Code, Name = @Name, Description = @Description, IsActive = @IsActive, UpdatedAt = SYSUTCDATETIME()
        OUTPUT inserted.ModuleId, inserted.Code, inserted.Name, inserted.Description, inserted.IsActive, inserted.CreatedAt, inserted.UpdatedAt
        WHERE ModuleId = @ModuleId
      `,
      [
        { name: "ModuleId", value: input.moduleId },
        { name: "Code", value: input.code },
        { name: "Name", value: input.name },
        { name: "Description", value: input.description ?? null },
        { name: "IsActive", value: input.isActive ?? true }
      ]
    );

    return result[0];
  }

  async deleteModule(moduleId: string) {
    const result = await this.query<ModuleRow>(
      `
        UPDATE security.Modules
        SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
        OUTPUT inserted.ModuleId
        WHERE ModuleId = @ModuleId
      `,
      [{ name: "ModuleId", value: moduleId }]
    );

    return result[0];
  }

  listActions() {
    return this.query<ActionRow>(`
      SELECT ActionId, Code, Name, Description, IsActive, CreatedAt, UpdatedAt
      FROM security.Actions
      ORDER BY Name
    `);
  }

  async createAction(input: CatalogInput) {
    const result = await this.query<ActionRow>(
      `
        INSERT INTO security.Actions (Code, Name, Description, IsActive)
        OUTPUT inserted.ActionId, inserted.Code, inserted.Name, inserted.Description, inserted.IsActive, inserted.CreatedAt, inserted.UpdatedAt
        VALUES (@Code, @Name, @Description, @IsActive)
      `,
      [
        { name: "Code", value: input.code },
        { name: "Name", value: input.name },
        { name: "Description", value: input.description ?? null },
        { name: "IsActive", value: input.isActive ?? true }
      ]
    );

    return result[0];
  }

  async updateAction(input: CatalogInput & { actionId: string }) {
    const result = await this.query<ActionRow>(
      `
        UPDATE security.Actions
        SET Code = @Code, Name = @Name, Description = @Description, IsActive = @IsActive, UpdatedAt = SYSUTCDATETIME()
        OUTPUT inserted.ActionId, inserted.Code, inserted.Name, inserted.Description, inserted.IsActive, inserted.CreatedAt, inserted.UpdatedAt
        WHERE ActionId = @ActionId
      `,
      [
        { name: "ActionId", value: input.actionId },
        { name: "Code", value: input.code },
        { name: "Name", value: input.name },
        { name: "Description", value: input.description ?? null },
        { name: "IsActive", value: input.isActive ?? true }
      ]
    );

    return result[0];
  }

  async deleteAction(actionId: string) {
    const result = await this.query<ActionRow>(
      `
        UPDATE security.Actions
        SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
        OUTPUT inserted.ActionId
        WHERE ActionId = @ActionId
      `,
      [{ name: "ActionId", value: actionId }]
    );

    return result[0];
  }

  listUserRoles(tenantId: string) {
    return this.query<AssignmentRow>(
      `
        SELECT TenantId, UserId, RoleId, CreatedAt
        FROM security.UserRoles
        WHERE TenantId = @TenantId
        ORDER BY CreatedAt DESC
      `,
      [{ name: "TenantId", value: tenantId }]
    );
  }

  async assignUserRole(tenantId: string, userId: string, roleId: string) {
    await this.query(
      `
        IF NOT EXISTS (
          SELECT 1 FROM security.UserRoles
          WHERE TenantId = @TenantId AND UserId = @UserId AND RoleId = @RoleId
        )
        BEGIN
          INSERT INTO security.UserRoles (TenantId, UserId, RoleId)
          VALUES (@TenantId, @UserId, @RoleId);
        END
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "UserId", value: userId },
        { name: "RoleId", value: roleId }
      ]
    );

    return { tenantId, userId, roleId };
  }

  async removeUserRole(tenantId: string, userId: string, roleId: string) {
    const result = await this.query<AssignmentRow>(
      `
        DELETE FROM security.UserRoles
        OUTPUT deleted.UserId
        WHERE TenantId = @TenantId
          AND UserId = @UserId
          AND RoleId = @RoleId
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "UserId", value: userId },
        { name: "RoleId", value: roleId }
      ]
    );

    return result[0];
  }

  listRolePermissions(tenantId: string) {
    return this.query<AssignmentRow>(
      `
        SELECT TenantId, RoleId, PermissionId, CreatedAt
        FROM security.RolePermissions
        WHERE TenantId = @TenantId
        ORDER BY CreatedAt DESC
      `,
      [{ name: "TenantId", value: tenantId }]
    );
  }

  async assignRolePermission(tenantId: string, roleId: string, permissionId: string) {
    await this.query(
      `
        IF NOT EXISTS (
          SELECT 1 FROM security.RolePermissions
          WHERE TenantId = @TenantId AND RoleId = @RoleId AND PermissionId = @PermissionId
        )
        BEGIN
          INSERT INTO security.RolePermissions (TenantId, RoleId, PermissionId)
          VALUES (@TenantId, @RoleId, @PermissionId);
        END
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "RoleId", value: roleId },
        { name: "PermissionId", value: permissionId }
      ]
    );

    return { tenantId, roleId, permissionId };
  }

  async removeRolePermission(tenantId: string, roleId: string, permissionId: string) {
    const result = await this.query<AssignmentRow>(
      `
        DELETE FROM security.RolePermissions
        OUTPUT deleted.RoleId
        WHERE TenantId = @TenantId
          AND RoleId = @RoleId
          AND PermissionId = @PermissionId
      `,
      [
        { name: "TenantId", value: tenantId },
        { name: "RoleId", value: roleId },
        { name: "PermissionId", value: permissionId }
      ]
    );

    return result[0];
  }
}

export const enterpriseSecurityRepository = new EnterpriseSecurityRepository();
