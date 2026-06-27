import { AppError } from "@backend/microservice-sdk";
import type { GiteaServiceConfig } from "../types/service.js";
import { parsePositiveInteger } from "../utils/strings.js";

function requireEnv(name: string, fallback = "") {
  const value = String(process.env[name] ?? fallback).trim();
  if (!value) {
    throw new AppError(`Missing environment variable: ${name}`, {
      statusCode: 500,
      code: "CONFIGURATION_ERROR"
    });
  }
  return value;
}

export function loadGiteaServiceConfig(): GiteaServiceConfig {
  return {
    serviceName: "gitea-service",
    port: parsePositiveInteger(process.env.GITEA_SERVICE_PORT ?? process.env.GITEA_READER_SERVICE_PORT, 8082),
    databaseUrl: requireEnv("DATABASE_URL"),
    jwtSecret: requireEnv("JWT_SECRET"),
    gitea: {
      baseUrl: requireEnv("GITEA_BASE_URL", "https://01.tomorrow-school.ai/git"),
      botToken: requireEnv("GITEA_BOT_TOKEN")
    },
    redis: {
      host: String(process.env.REDIS_ADDR ?? "127.0.0.1:6379")
        .trim()
        .split(":")[0] || "127.0.0.1",
      port: parsePositiveInteger(String(process.env.REDIS_ADDR ?? "127.0.0.1:6379").trim().split(":")[1], 6379),
      password: String(process.env.REDIS_PASSWORD ?? "").trim(),
      db: parsePositiveInteger(process.env.REDIS_DB, 0),
      queueName: String(process.env.ANALYSIS_QUEUE_NAME ?? "analysis_jobs").trim() || "analysis_jobs"
    },
    tomorrow: {
      serviceUrl: requireEnv("TOMORROW_SERVICE_URL", "http://localhost:3001"),
      profilePath: String(process.env.TOMORROW_PROFILE_PATH ?? "/intra/astanahub/profile?event=96").trim()
    },
    files: {
      maxFileSizeBytes: parsePositiveInteger(process.env.MAX_FILE_SIZE_BYTES, 204800)
    }
  };
}
