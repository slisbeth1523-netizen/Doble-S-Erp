import { env } from "../config/env.js";
import { clock } from "./clock.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const minimumLevel: LogLevel = env.nodeEnv === "production" ? "info" : "debug";

function shouldLog(level: LogLevel) {
  return levelPriority[level] >= levelPriority[minimumLevel];
}

function serializeMeta(meta?: unknown) {
  if (meta === undefined) {
    return "";
  }

  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return " [unserializable-meta]";
  }
}

function write(level: LogLevel, message: string, meta?: unknown) {
  if (!shouldLog(level)) {
    return;
  }

  const line = `[${clock.isoNow()}] ${level.toUpperCase()} ${message}${serializeMeta(meta)}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export const logger = {
  debug: (message: string, meta?: unknown) => write("debug", message, meta),
  info: (message: string, meta?: unknown) => write("info", message, meta),
  warn: (message: string, meta?: unknown) => write("warn", message, meta),
  error: (message: string, meta?: unknown) => write("error", message, meta)
} as const;
