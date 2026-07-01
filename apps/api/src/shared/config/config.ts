import { config as configService } from "../../config/config.service.js";

export const config = {
  nodeEnv: configService.get("app.nodeEnv"),
  apiPort: configService.get("api.port"),
  corsOrigin: configService.get("app.corsOrigin"),
  jwt: {
    secret: configService.get("jwt.secret"),
    expiresIn: configService.get("jwt.expiresIn")
  },
  sqlServer: {
    server: configService.get("sql.host"),
    port: configService.get("sql.port"),
    database: configService.get("sql.database"),
    user: configService.get("sql.user"),
    password: configService.get("sql.password"),
    options: {
      encrypt: configService.get("sql.encrypt"),
      trustServerCertificate: configService.get("sql.trustServerCertificate")
    }
  }
} as const;
