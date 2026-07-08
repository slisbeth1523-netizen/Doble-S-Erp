import { config } from "./config.service.js";

export const env = {
  nodeEnv: config.get("app.nodeEnv"),
  apiPort: config.get("api.port"),
  apiPrefix: config.get("api.prefix"),
  corsOrigin: config.get("app.corsOrigin"),
  jwtSecret: config.get("jwt.secret"),
  jwtExpiresIn: config.get("jwt.expiresIn"),
  sqlServer: {
    server: config.get("sql.host"),
    port: config.get("sql.port"),
    database: config.get("sql.database"),
    user: config.get("sql.user"),
    password: config.get("sql.password"),
    options: {
      encrypt: config.get("sql.encrypt"),
      trustServerCertificate: config.get("sql.trustServerCertificate")
    }
  }
} as const;
