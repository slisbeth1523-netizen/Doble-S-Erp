import { getSqlPool, sql } from "../../../shared/database/sqlserver.js";

export async function listRoles(tenantId: string) {
  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input("TenantId", sql.UniqueIdentifier, tenantId)
    .query(`
      SELECT RoleId, TenantId, Code, Name, IsSystemRole, CreatedAt
      FROM security.Roles
      WHERE TenantId = @TenantId
      ORDER BY Name
    `);

  return result.recordset;
}

export async function createRole(input: { tenantId: string; code: string; name: string }) {
  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input("TenantId", sql.UniqueIdentifier, input.tenantId)
    .input("Code", sql.NVarChar(80), input.code)
    .input("Name", sql.NVarChar(160), input.name)
    .query(`
      INSERT INTO security.Roles (TenantId, Code, Name)
      OUTPUT inserted.RoleId, inserted.TenantId, inserted.Code, inserted.Name, inserted.IsSystemRole, inserted.CreatedAt
      VALUES (@TenantId, @Code, @Name)
    `);

  return result.recordset[0];
}

export async function listPermissions() {
  const pool = await getSqlPool();
  const result = await pool.request().query(`
    SELECT PermissionId, ModuleCode, ActionCode, Description, CreatedAt
    FROM security.Permissions
    ORDER BY ModuleCode, ActionCode
  `);

  return result.recordset;
}

export async function userHasPermission(input: {
  tenantId: string;
  userId: string;
  moduleCode: string;
  actionCode: string;
}) {
  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input("TenantId", sql.UniqueIdentifier, input.tenantId)
    .input("UserId", sql.UniqueIdentifier, input.userId)
    .input("ModuleCode", sql.NVarChar(80), input.moduleCode)
    .input("ActionCode", sql.NVarChar(80), input.actionCode)
    .query(`
      SELECT TOP 1 p.PermissionId
      FROM security.UserRoles ur
      INNER JOIN security.RolePermissions rp
        ON rp.RoleId = ur.RoleId
       AND rp.TenantId = ur.TenantId
      INNER JOIN security.Permissions p
        ON p.PermissionId = rp.PermissionId
      WHERE ur.TenantId = @TenantId
        AND ur.UserId = @UserId
        AND p.ModuleCode = @ModuleCode
        AND p.ActionCode = @ActionCode
        AND ISNULL(p.IsActive, 1) = 1
    `);

  return result.recordset.length > 0;
}
