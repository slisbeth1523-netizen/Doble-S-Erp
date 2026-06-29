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
