import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const defaultCorsOrigins =
  "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174";

function parseCorsOrigins(value: string) {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseSqlServerHost(value: string) {
  const [host, instanceName] = value.includes("\\") ? value.split("\\", 2) : [value, undefined];

  return { host, instanceName };
}

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4001),
  API_PREFIX: z.string().default("/api"),
  CORS_ORIGIN: z.string().default(defaultCorsOrigins),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must have at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  SQLSERVER_HOST: z.string().min(1, "SQLSERVER_HOST is required"),
  SQLSERVER_INSTANCE: z.string().optional(),
  SQLSERVER_PORT: z.coerce.number().int().positive().default(1433),
  SQLSERVER_DATABASE: z.string().min(1, "SQLSERVER_DATABASE is required"),
  SQLSERVER_USER: z.string().min(1, "SQLSERVER_USER is required"),
  SQLSERVER_PASSWORD: z.string().min(1, "SQLSERVER_PASSWORD is required"),
  SQLSERVER_ENCRYPT: z.coerce.boolean().default(false),
  SQLSERVER_TRUST_SERVER_CERTIFICATE: z.coerce.boolean().default(true)
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  const messages = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid application configuration: ${messages.join("; ")}`);
}

const parsedSqlServerHost = parseSqlServerHost(parsed.data.SQLSERVER_HOST);

const values = {
  api: {
    port: parsed.data.API_PORT,
    prefix: parsed.data.API_PREFIX
  },
  app: {
    nodeEnv: parsed.data.NODE_ENV,
    corsOrigin: parseCorsOrigins(parsed.data.CORS_ORIGIN)
  },
  jwt: {
    secret: parsed.data.JWT_SECRET,
    expiresIn: parsed.data.JWT_EXPIRES_IN
  },
  sql: {
    host: parsedSqlServerHost.host,
    instanceName: parsed.data.SQLSERVER_INSTANCE || parsedSqlServerHost.instanceName,
    port: parsed.data.SQLSERVER_PORT,
    database: parsed.data.SQLSERVER_DATABASE,
    user: parsed.data.SQLSERVER_USER,
    password: parsed.data.SQLSERVER_PASSWORD,
    encrypt: parsed.data.SQLSERVER_ENCRYPT,
    trustServerCertificate: parsed.data.SQLSERVER_TRUST_SERVER_CERTIFICATE
  }
} as const;

type ConfigValues = typeof values;
type ConfigKey =
  | "api.port"
  | "api.prefix"
  | "app.nodeEnv"
  | "app.corsOrigin"
  | "jwt.secret"
  | "jwt.expiresIn"
  | "sql.host"
  | "sql.instanceName"
  | "sql.port"
  | "sql.database"
  | "sql.user"
  | "sql.password"
  | "sql.encrypt"
  | "sql.trustServerCertificate";

type ConfigValueMap = {
  "api.port": ConfigValues["api"]["port"];
  "api.prefix": ConfigValues["api"]["prefix"];
  "app.nodeEnv": ConfigValues["app"]["nodeEnv"];
  "app.corsOrigin": ConfigValues["app"]["corsOrigin"];
  "jwt.secret": ConfigValues["jwt"]["secret"];
  "jwt.expiresIn": ConfigValues["jwt"]["expiresIn"];
  "sql.host": ConfigValues["sql"]["host"];
  "sql.instanceName": ConfigValues["sql"]["instanceName"];
  "sql.port": ConfigValues["sql"]["port"];
  "sql.database": ConfigValues["sql"]["database"];
  "sql.user": ConfigValues["sql"]["user"];
  "sql.password": ConfigValues["sql"]["password"];
  "sql.encrypt": ConfigValues["sql"]["encrypt"];
  "sql.trustServerCertificate": ConfigValues["sql"]["trustServerCertificate"];
};

export const config = {
  get<TKey extends ConfigKey>(key: TKey): ConfigValueMap[TKey] {
    const [section, property] = key.split(".") as [keyof ConfigValues, string];
    return values[section][property as keyof ConfigValues[typeof section]] as ConfigValueMap[TKey];
  },
  values
} as const;
