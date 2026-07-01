import { getSqlPool, sql } from "../../../shared/database/sqlserver.js";
import { enterpriseSecurityRepository } from "./enterprise-security.repository.js";

export async function listRoles(tenantId: string) {
  return enterpriseSecurityRepository.listRoles(tenantId);
}

export async function createRole(input: { tenantId: string; code: string; name: string }) {
  return enterpriseSecurityRepository.createRole(input);
}

export async function listPermissions() {
  return enterpriseSecurityRepository.listPermissions();
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
