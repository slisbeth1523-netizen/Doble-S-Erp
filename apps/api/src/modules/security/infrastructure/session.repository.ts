import { getSqlPool, sql } from "../../../shared/database/sqlserver.js";

export async function createSession(input: {
  tenantId: string;
  userId: string;
  companyId?: string;
  jwtId: string;
  expiresAt: Date;
}) {
  const pool = await getSqlPool();

  await pool
    .request()
    .input("TenantId", sql.UniqueIdentifier, input.tenantId)
    .input("UserId", sql.UniqueIdentifier, input.userId)
    .input("CompanyId", sql.UniqueIdentifier, input.companyId ?? null)
    .input("JwtId", sql.UniqueIdentifier, input.jwtId)
    .input("ExpiresAt", sql.DateTime2, input.expiresAt)
    .query(`
      INSERT INTO security.Sessions (
        TenantId,
        UserId,
        CompanyId,
        JwtId,
        ExpiresAt
      )
      VALUES (
        @TenantId,
        @UserId,
        @CompanyId,
        @JwtId,
        @ExpiresAt
      )
    `);
}

export async function isSessionActive(input: {
  tenantId: string;
  userId: string;
  jwtId: string;
}) {
  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input("TenantId", sql.UniqueIdentifier, input.tenantId)
    .input("UserId", sql.UniqueIdentifier, input.userId)
    .input("JwtId", sql.UniqueIdentifier, input.jwtId)
    .query(`
      SELECT TOP 1 SessionId
      FROM security.Sessions
      WHERE TenantId = @TenantId
        AND UserId = @UserId
        AND JwtId = @JwtId
        AND RevokedAt IS NULL
        AND ExpiresAt > SYSUTCDATETIME()
    `);

  return result.recordset.length > 0;
}

export async function revokeSession(input: {
  tenantId: string;
  userId: string;
  jwtId: string;
}) {
  const pool = await getSqlPool();

  await pool
    .request()
    .input("TenantId", sql.UniqueIdentifier, input.tenantId)
    .input("UserId", sql.UniqueIdentifier, input.userId)
    .input("JwtId", sql.UniqueIdentifier, input.jwtId)
    .query(`
      UPDATE security.Sessions
      SET RevokedAt = SYSUTCDATETIME()
      WHERE TenantId = @TenantId
        AND UserId = @UserId
        AND JwtId = @JwtId
        AND RevokedAt IS NULL
    `);
}
