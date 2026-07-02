import fs from "node:fs";
import path from "node:path";
import sql from "mssql";

import { getSqlConfig } from "./local-env.mjs";

const seedsDir = path.join(process.cwd(), "database", "sqlserver", "seeds");

function splitSqlBatches(script) {
  return script
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((batch) => batch.trim())
    .filter(Boolean);
}

async function run() {
  const files = fs
    .readdirSync(seedsDir)
    .filter((fileName) => /^\d+_.*\.sql$/i.test(fileName) && !fileName.endsWith(".template.sql"))
    .sort((left, right) => left.localeCompare(right));

  if (files.length === 0) {
    console.log("No seed files found.");
    return;
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    for (const fileName of files) {
      console.log(`seed ${fileName}`);
      const fullPath = path.join(seedsDir, fileName);
      const batches = splitSqlBatches(fs.readFileSync(fullPath, "utf8"));

      for (const batch of batches) {
        await pool.request().batch(batch);
      }
    }
  } finally {
    await pool.close();
  }
}

run().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

