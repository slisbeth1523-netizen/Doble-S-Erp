import fs from "node:fs";
import path from "node:path";

export function loadLocalEnv(cwd = process.cwd()) {
  const envPath = path.join(cwd, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function getSqlConfig() {
  loadLocalEnv();
  const rawServer = process.env.SQLSERVER_HOST ?? "localhost";
  const [server, instanceFromServer] = rawServer.includes("\\")
    ? rawServer.split("\\", 2)
    : [rawServer, undefined];
  const instanceName = process.env.SQLSERVER_INSTANCE || instanceFromServer;
  const options = {
    encrypt: String(process.env.SQLSERVER_ENCRYPT ?? "false").toLowerCase() === "true",
    trustServerCertificate:
      String(process.env.SQLSERVER_TRUST_SERVER_CERTIFICATE ?? "true").toLowerCase() === "true",
    ...(instanceName ? { instanceName } : {})
  };

  return {
    server,
    ...(instanceName ? {} : { port: Number(process.env.SQLSERVER_PORT ?? 1433) }),
    database: process.env.SQLSERVER_DATABASE ?? "DOBLE_S_ERP",
    user: process.env.SQLSERVER_USER ?? "sa",
    password: process.env.SQLSERVER_PASSWORD ?? "",
    options
  };
}
