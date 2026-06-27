import type { AppConfig } from "../config/AppConfig.js";
import type { Logger } from "./Logger.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const REDACTED = "[REDACTED]";
const SENSITIVE_KEYS = new Set(["authorization", "password", "token", "secret", "access_token", "refresh_token"]);

function shouldLog(minimumLevel: LogLevel, candidate: LogLevel) {
  return LEVELS[candidate] >= LEVELS[minimumLevel];
}

function sanitizeMeta(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMeta(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    sanitized[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : sanitizeMeta(nestedValue);
  }

  return sanitized;
}

function write(level: LogLevel, serviceName: string, message: string, meta: unknown) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: serviceName,
    message,
    ...(meta === undefined ? {} : { meta: sanitizeMeta(meta) })
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

export function createLogger(config: Pick<AppConfig, "serviceName" | "logLevel">): Logger {
  const serviceName = config.serviceName.trim();
  const minimumLevel = (config.logLevel?.toLowerCase() as LogLevel | undefined) ?? "info";

  return {
    debug(message, meta) {
      if (shouldLog(minimumLevel, "debug")) {
        write("debug", serviceName, message, meta);
      }
    },
    info(message, meta) {
      if (shouldLog(minimumLevel, "info")) {
        write("info", serviceName, message, meta);
      }
    },
    warn(message, meta) {
      if (shouldLog(minimumLevel, "warn")) {
        write("warn", serviceName, message, meta);
      }
    },
    error(message, meta) {
      if (shouldLog(minimumLevel, "error")) {
        write("error", serviceName, message, meta);
      }
    }
  };
}
