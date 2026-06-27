import { AppError } from "@backend/microservice-sdk";
import type { UserServiceConfig } from "../types/service.js";
import { validatePort } from "../validation/serviceValidation.js";

function requireEnv(name: string, fallback = "") {
  const value = String(process.env[name] ?? fallback).trim();
  if (!value) {
    throw new AppError(`Missing environment variable: ${name}`, {
      statusCode: 500,
      code: "SERVICE_CONFIG_INVALID"
    });
  }

  return value;
}

export function loadUserServiceConfig(): UserServiceConfig {
  const port = validatePort(process.env.USER_SERVICE_PORT ?? "3002", "USER_SERVICE_PORT");
  const serviceName = "user-service";
  const databaseUrl = String(process.env.DATABASE_URL ?? "").trim();

  if (!serviceName) {
    throw new AppError("User service name is required.", {
      statusCode: 500,
      code: "SERVICE_CONFIG_INVALID"
    });
  }

  return {
    serviceName,
    port,
    internalServiceToken: requireEnv("INTERNAL_SERVICE_TOKEN", "local-internal-token"),
    repository: {
      driver:
        process.env.USER_SERVICE_REPOSITORY === "database" || process.env.AUTH_SERVICE_REPOSITORY === "database" || databaseUrl
          ? "database"
          : "memory",
      databaseUrl
    }
  };
}
