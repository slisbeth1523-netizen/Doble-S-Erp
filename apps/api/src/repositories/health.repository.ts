import { checkSqlServerConnection } from "../db/sqlserver.js";

export async function getDatabaseHealth() {
  const connected = await checkSqlServerConnection();

  return {
    connected
  };
}

