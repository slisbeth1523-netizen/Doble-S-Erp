import { getSqlPool, sql } from "../../../shared/database/sqlserver.js";
import type { AuditEvent, FunctionalAuditEvent } from "../domain/audit-event.js";

export async function recordAuditEvent(event: AuditEvent) {
  const pool = await getSqlPool();

  await pool
    .request()
    .input("TenantId", sql.UniqueIdentifier, event.tenantId ?? null)
    .input("CompanyId", sql.UniqueIdentifier, event.companyId ?? null)
    .input("UserId", sql.UniqueIdentifier, event.userId ?? null)
    .input("Method", sql.NVarChar(16), event.method)
    .input("Path", sql.NVarChar(512), event.path)
    .input("StatusCode", sql.Int, event.statusCode)
    .input("IpAddress", sql.NVarChar(64), event.ipAddress ?? null)
    .input("UserAgent", sql.NVarChar(512), event.userAgent ?? null)
    .query(`
      INSERT INTO audit.AuditLogs (
        TenantId,
        CompanyId,
        UserId,
        Method,
        Path,
        StatusCode,
        IpAddress,
        UserAgent
      )
      VALUES (
        @TenantId,
        @CompanyId,
        @UserId,
        @Method,
        @Path,
        @StatusCode,
        @IpAddress,
        @UserAgent
      )
    `);
}

export async function recordFunctionalAuditEvent(event: FunctionalAuditEvent) {
  const pool = await getSqlPool();

  await pool
    .request()
    .input("TenantId", sql.UniqueIdentifier, event.tenantId ?? null)
    .input("CompanyId", sql.UniqueIdentifier, event.companyId ?? null)
    .input("UserId", sql.UniqueIdentifier, event.userId ?? null)
    .input("Action", sql.NVarChar(120), event.action)
    .input("EntityName", sql.NVarChar(160), event.entityName ?? null)
    .input("EntityId", sql.NVarChar(120), event.entityId ?? null)
    .input("MetadataJson", sql.NVarChar(sql.MAX), event.metadata ? JSON.stringify(event.metadata) : null)
    .query(`
      INSERT INTO audit.AuditEvents (
        TenantId,
        CompanyId,
        UserId,
        Action,
        EntityName,
        EntityId,
        MetadataJson
      )
      VALUES (
        @TenantId,
        @CompanyId,
        @UserId,
        @Action,
        @EntityName,
        @EntityId,
        @MetadataJson
      )
    `);
}
