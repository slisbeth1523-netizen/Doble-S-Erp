import { config as configService } from "../../config/config.service.js";

function sqlServerConfig() {
  const instanceName = configService.get("sql.instanceName");

  return {
    server: configService.get("sql.host"),
    ...(instanceName ? {} : { port: configService.get("sql.port") }),
    database: configService.get("sql.database"),
    user: configService.get("sql.user"),
    password: configService.get("sql.password"),
    options: {
      encrypt: configService.get("sql.encrypt"),
      trustServerCertificate: configService.get("sql.trustServerCertificate"),
      ...(instanceName ? { instanceName } : {})
    }
  };
}

export const config = {
  nodeEnv: configService.get("app.nodeEnv"),
  apiPort: configService.get("api.port"),
  corsOrigin: configService.get("app.corsOrigin"),
  jwt: {
    secret: configService.get("jwt.secret"),
    expiresIn: configService.get("jwt.expiresIn")
  },
  sqlServer: sqlServerConfig()
} as const;
