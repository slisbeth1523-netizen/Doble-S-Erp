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

export async function userHasCompanyAccess(input: {
  tenantId: string;
  userId: string;
  companyId: string;
}) {
  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input("TenantId", sql.UniqueIdentifier, input.tenantId)
    .input("UserId", sql.UniqueIdentifier, input.userId)
    .input("CompanyId", sql.UniqueIdentifier, input.companyId)
    .query(`
      SELECT TOP 1 1 AS HasAccess
      FROM security.UserCompanyAccess uca
      INNER JOIN core.Companies c
        ON c.CompanyId = uca.CompanyId
       AND c.TenantId = uca.TenantId
      WHERE uca.TenantId = @TenantId
        AND uca.UserId = @UserId
        AND uca.CompanyId = @CompanyId
        AND c.IsActive = 1
    `);

  return result.recordset.length > 0;
}

export async function createCompanyForUser(input: {
  tenantId: string;
  userId: string;
  legalName: string;
  tradeName?: string;
  taxId?: string;
}) {
  const pool = await getSqlPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const countResult = await new sql.Request(transaction)
      .input("TenantId", sql.UniqueIdentifier, input.tenantId)
      .query(`
        SELECT COUNT(1) AS CompanyCount
        FROM core.Companies
        WHERE TenantId = @TenantId
      `);

    const isFirstCompany = Number(countResult.recordset[0]?.CompanyCount ?? 0) === 0;

    const companyResult = await new sql.Request(transaction)
      .input("TenantId", sql.UniqueIdentifier, input.tenantId)
      .input("LegalName", sql.NVarChar(250), input.legalName)
      .input("TradeName", sql.NVarChar(250), input.tradeName ?? null)
      .input("TaxId", sql.NVarChar(32), input.taxId ?? null)
      .query(`
        INSERT INTO core.Companies (TenantId, LegalName, TradeName, TaxId)
        OUTPUT inserted.CompanyId, inserted.TenantId, inserted.LegalName, inserted.TradeName, inserted.TaxId, inserted.IsActive, inserted.CreatedAt
        VALUES (@TenantId, @LegalName, @TradeName, @TaxId)
      `);

    const company = companyResult.recordset[0];

    await new sql.Request(transaction)
      .input("TenantId", sql.UniqueIdentifier, input.tenantId)
      .input("UserId", sql.UniqueIdentifier, input.userId)
      .input("CompanyId", sql.UniqueIdentifier, company.CompanyId)
      .input("IsDefault", sql.Bit, isFirstCompany)
      .query(`
        INSERT INTO security.UserCompanyAccess (TenantId, UserId, CompanyId, IsDefault)
        VALUES (@TenantId, @UserId, @CompanyId, @IsDefault)
      `);

    if (isFirstCompany) {
      await new sql.Request(transaction)
        .input("TenantId", sql.UniqueIdentifier, input.tenantId)
        .input("UserId", sql.UniqueIdentifier, input.userId)
        .input("CompanyId", sql.UniqueIdentifier, company.CompanyId)
        .query(`
          UPDATE security.Users
          SET DefaultCompanyId = @CompanyId,
              UpdatedAt = SYSUTCDATETIME()
          WHERE TenantId = @TenantId
            AND UserId = @UserId
            AND DefaultCompanyId IS NULL
        `);
    }

    await transaction.commit();
    return company;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
