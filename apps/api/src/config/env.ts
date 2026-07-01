import dotenv from "dotenv";

dotenv.config();

type NodeEnv = "development" | "test" | "production";

function readRequired(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readNumber(name: string, fallback: number) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer.`);
  }

  return parsed;
}

function readBoolean(name: string, fallback: boolean) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  return rawValue.toLowerCase() === "true";
}

export const env = {
  nodeEnv: (process.env.NODE_ENV ?? "development") as NodeEnv,
  apiPort: readNumber("API_PORT", 4001),
  apiPrefix: process.env.API_PREFIX ?? "/api",
  jwtSecret: readRequired("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  sqlServer: {
    server: readRequired("SQLSERVER_HOST"),
    port: readNumber("SQLSERVER_PORT", 1433),
    database: readRequired("SQLSERVER_DATABASE"),
    user: readRequired("SQLSERVER_USER"),
    password: readRequired("SQLSERVER_PASSWORD"),
    options: {
      encrypt: readBoolean("SQLSERVER_ENCRYPT", false),
      trustServerCertificate: readBoolean("SQLSERVER_TRUST_SERVER_CERTIFICATE", true)
    }
  }
} as const;

