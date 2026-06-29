import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must have at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("1h"),
  SQLSERVER_HOST: z.string().min(1),
  SQLSERVER_PORT: z.coerce.number().int().positive().default(1433),
  SQLSERVER_DATABASE: z.string().min(1),
  SQLSERVER_USER: z.string().min(1),
  SQLSERVER_PASSWORD: z.string().min(1),
  SQLSERVER_ENCRYPT: z.coerce.boolean().default(false),
  SQLSERVER_TRUST_SERVER_CERTIFICATE: z.coerce.boolean().default(true)
});

const parsedEnv = envSchema.parse(process.env);

export const config = {
  nodeEnv: parsedEnv.NODE_ENV,
  apiPort: parsedEnv.API_PORT,
  corsOrigin: parsedEnv.CORS_ORIGIN,
  jwt: {
    secret: parsedEnv.JWT_SECRET,
    expiresIn: parsedEnv.JWT_EXPIRES_IN
  },
  sqlServer: {
    server: parsedEnv.SQLSERVER_HOST,
    port: parsedEnv.SQLSERVER_PORT,
    database: parsedEnv.SQLSERVER_DATABASE,
    user: parsedEnv.SQLSERVER_USER,
    password: parsedEnv.SQLSERVER_PASSWORD,
    options: {
      encrypt: parsedEnv.SQLSERVER_ENCRYPT,
      trustServerCertificate: parsedEnv.SQLSERVER_TRUST_SERVER_CERTIFICATE
    }
  }
} as const;
