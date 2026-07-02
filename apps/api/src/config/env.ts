import { config } from "./config.service.js";

function sqlServerConfig() {
  const instanceName = config.get("sql.instanceName");

  return {
    server: config.get("sql.host"),
    ...(instanceName ? {} : { port: config.get("sql.port") }),
    database: config.get("sql.database"),
    user: config.get("sql.user"),
    password: config.get("sql.password"),
    options: {
      encrypt: config.get("sql.encrypt"),
      trustServerCertificate: config.get("sql.trustServerCertificate"),
      ...(instanceName ? { instanceName } : {})
    }
  };
}

export const env = {
  nodeEnv: config.get("app.nodeEnv"),
  apiPort: config.get("api.port"),
  apiPrefix: config.get("api.prefix"),
  corsOrigin: config.get("app.corsOrigin"),
  jwtSecret: config.get("jwt.secret"),
  jwtExpiresIn: config.get("jwt.expiresIn"),
  sqlServer: sqlServerConfig()
} as const;
