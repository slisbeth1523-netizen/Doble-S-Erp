import sql from "mssql";

import { env } from "../config/env.js";

let pool: sql.ConnectionPool | undefined;
let poolPromise: Promise<sql.ConnectionPool> | undefined;

export async function getSqlServerPool() {
  if (pool?.connected) {
    return pool;
  }

  if (pool && !pool.connected) {
    pool = undefined;
    poolPromise = undefined;
  }

  if (poolPromise) {
    return poolPromise;
  }

  poolPromise = new sql.ConnectionPool(env.sqlServer)
    .connect()
    .then((connectedPool) => {
      pool = connectedPool;
      pool.on("error", () => {
        pool = undefined;
        poolPromise = undefined;
      });

      return connectedPool;
    })
    .catch((error: unknown) => {
      pool = undefined;
      poolPromise = undefined;
      throw error;
    });

  return poolPromise;
}

export async function checkSqlServerConnection() {
  try {
    const connection = await getSqlServerPool();
    const result = await connection.request().query("SELECT 1 AS ok");

    return result.recordset[0]?.ok === 1;
  } catch {
    return false;
  }
}

export { sql };
