import sql from "mssql";

import { config } from "../config/config.js";

let pool: sql.ConnectionPool | undefined;

export async function getSqlPool() {
  if (pool?.connected) {
    return pool;
  }

  pool = await sql.connect(config.sqlServer);
  return pool;
}

export { sql };
