import { getSqlPool, sql } from "../../../shared/database/sqlserver.js";
import { enterpriseSecurityRepository } from "./enterprise-security.repository.js";

type UserRecord = {
  UserId: string;
  TenantId: string;
  CompanyId: string | null;
  Email: string;
  PasswordHash: string;
  Roles: string | null;
};

export async function findActiveUserByEmail(email: string) {
  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input("Email", sql.NVarChar(256), email)
    .query<UserRecord>(`
      SELECT TOP 1
        u.UserId,
        u.TenantId,
        u.DefaultCompanyId AS CompanyId,
        u.Email,
        u.PasswordHash,
        STRING_AGG(r.Code, ',') AS Roles
      FROM security.Users u
      LEFT JOIN security.UserRoles ur ON ur.UserId = u.UserId AND ur.TenantId = u.TenantId
      LEFT JOIN security.Roles r ON r.RoleId = ur.RoleId AND r.TenantId = ur.TenantId
      WHERE u.Email = @Email
        AND u.IsActive = 1
      GROUP BY u.UserId, u.TenantId, u.DefaultCompanyId, u.Email, u.PasswordHash
    `);

  return result.recordset[0];
}

export async function listUsers(tenantId: string) {
  return enterpriseSecurityRepository.listUsers(tenantId);
}

export async function createUser(input: {
  tenantId: string;
  defaultCompanyId?: string;
  email: string;
  displayName: string;
  passwordHash: string;
}) {
  return enterpriseSecurityRepository.createUser(input);
}
