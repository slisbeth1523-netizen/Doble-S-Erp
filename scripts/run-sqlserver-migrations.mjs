import fs from "node:fs";
import path from "node:path";
import sql from "mssql";

import { getSqlConfig } from "./local-env.mjs";

const migrationsDir = path.join(process.cwd(), "database", "sqlserver", "migrations");

function splitSqlBatches(script) {
  return script
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((batch) => batch.trim())
    .filter(Boolean);
}

async function ensureMigrationTable(pool) {
  await pool.request().batch(`
    IF OBJECT_ID('dbo.SchemaMigrations', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.SchemaMigrations (
        MigrationId INT IDENTITY(1,1) NOT NULL,
        FileName NVARCHAR(260) NOT NULL,
        AppliedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SchemaMigrations_AppliedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_SchemaMigrations PRIMARY KEY (MigrationId),
        CONSTRAINT UQ_SchemaMigrations_FileName UNIQUE (FileName)
      );
    END;
  `);
}

async function hasMigration(pool, fileName) {
  const result = await pool
    .request()
    .input("FileName", sql.NVarChar(260), fileName)
    .query("SELECT 1 AS Applied FROM dbo.SchemaMigrations WHERE FileName = @FileName");

  return result.recordset.length > 0;
}

async function markMigration(pool, fileName) {
  await pool
    .request()
    .input("FileName", sql.NVarChar(260), fileName)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE FileName = @FileName)
      BEGIN
        INSERT INTO dbo.SchemaMigrations (FileName) VALUES (@FileName);
      END;
    `);
}

async function run() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((fileName) => /^\d+_.*\.sql$/i.test(fileName))
    .sort((left, right) => left.localeCompare(right));

  const pool = await sql.connect(getSqlConfig());

  try {
    await ensureMigrationTable(pool);

    for (const fileName of files) {
      if (await hasMigration(pool, fileName)) {
        console.log(`skip ${fileName}`);
        continue;
      }

      console.log(`apply ${fileName}`);
      const fullPath = path.join(migrationsDir, fileName);
      const batches = splitSqlBatches(fs.readFileSync(fullPath, "utf8"));
      const transaction = new sql.Transaction(pool);

      await transaction.begin();

      try {
        for (const batch of batches) {
          await new sql.Request(transaction).batch(batch);
        }

        await new sql.Request(transaction)
          .input("FileName", sql.NVarChar(260), fileName)
          .query("INSERT INTO dbo.SchemaMigrations (FileName) VALUES (@FileName)");
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }

      await markMigration(pool, fileName);
    }
  } finally {
    await pool.close();
  }
}

run().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

