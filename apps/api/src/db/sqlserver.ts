import sql from "mssql";

import { env } from "../config/env.js";

let pool: sql.ConnectionPool | undefined;

export async function getSqlServerPool() {
  if (pool?.connected) {
    return pool;
  }

  pool = await sql.connect(env.sqlServer);
  return pool;
}

export async function checkSqlServerConnection() {
  const connection = await getSqlServerPool();
  const result = await connection.request().query("SELECT 1 AS ok");

  return result.recordset[0]?.ok === 1;
}

export { sql };

