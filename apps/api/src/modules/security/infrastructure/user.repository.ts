import { getSqlPool, sql } from "../../../shared/database/sqlserver.js";

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
  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input("TenantId", sql.UniqueIdentifier, tenantId)
    .query(`
      SELECT UserId, TenantId, DefaultCompanyId, Email, DisplayName, IsActive, LastLoginAt, CreatedAt
      FROM security.Users
      WHERE TenantId = @TenantId
      ORDER BY DisplayName
    `);

  return result.recordset;
}

export async function createUser(input: {
  tenantId: string;
  defaultCompanyId?: string;
  email: string;
  displayName: string;
  passwordHash: string;
}) {
  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input("TenantId", sql.UniqueIdentifier, input.tenantId)
    .input("DefaultCompanyId", sql.UniqueIdentifier, input.defaultCompanyId ?? null)
    .input("Email", sql.NVarChar(256), input.email)
    .input("DisplayName", sql.NVarChar(200), input.displayName)
    .input("PasswordHash", sql.NVarChar(255), input.passwordHash)
    .query(`
      INSERT INTO security.Users (TenantId, DefaultCompanyId, Email, DisplayName, PasswordHash)
      OUTPUT inserted.UserId, inserted.TenantId, inserted.DefaultCompanyId, inserted.Email, inserted.DisplayName, inserted.IsActive, inserted.CreatedAt
      VALUES (@TenantId, @DefaultCompanyId, @Email, @DisplayName, @PasswordHash)
    `);

  return result.recordset[0];
}
