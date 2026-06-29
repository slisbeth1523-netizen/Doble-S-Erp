import { getSqlPool, sql } from "../../../shared/database/sqlserver.js";

export async function listTenants() {
  const pool = await getSqlPool();
  const result = await pool.request().query(`
    SELECT TenantId, Name, Slug, IsActive, CreatedAt
    FROM core.Tenants
    WHERE IsActive = 1
    ORDER BY Name
  `);

  return result.recordset;
}

export async function listCompaniesForUser(tenantId: string, userId: string) {
  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input("TenantId", sql.UniqueIdentifier, tenantId)
    .input("UserId", sql.UniqueIdentifier, userId)
    .query(`
      SELECT c.CompanyId, c.LegalName, c.TradeName, c.TaxId, c.IsActive
      FROM core.Companies c
      INNER JOIN security.UserCompanyAccess uca
        ON uca.CompanyId = c.CompanyId
       AND uca.TenantId = c.TenantId
      WHERE c.TenantId = @TenantId
        AND uca.UserId = @UserId
        AND c.IsActive = 1
      ORDER BY c.LegalName
    `);

  return result.recordset;
}

export async function createCompany(input: {
  tenantId: string;
  legalName: string;
  tradeName?: string;
  taxId?: string;
}) {
  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input("TenantId", sql.UniqueIdentifier, input.tenantId)
    .input("LegalName", sql.NVarChar(250), input.legalName)
    .input("TradeName", sql.NVarChar(250), input.tradeName ?? null)
    .input("TaxId", sql.NVarChar(32), input.taxId ?? null)
    .query(`
      INSERT INTO core.Companies (TenantId, LegalName, TradeName, TaxId)
      OUTPUT inserted.CompanyId, inserted.TenantId, inserted.LegalName, inserted.TradeName, inserted.TaxId, inserted.IsActive, inserted.CreatedAt
      VALUES (@TenantId, @LegalName, @TradeName, @TaxId)
    `);

  return result.recordset[0];
}
