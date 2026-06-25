import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type { WorkerServiceConfig } from "../types/service.ts";
import { readPositiveInt, readRequiredEnv } from "../validation/envValidation.ts";

function readOptionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

export function loadWorkerServiceConfig(): WorkerServiceConfig {
  const port = readPositiveInt("WORKER_SERVICE_PORT", 3007);
  const redisAddr = readOptionalEnv("REDIS_ADDR", "127.0.0.1:6379");
  const redisPassword = readOptionalEnv("REDIS_PASSWORD", "");
  const redisDb = readPositiveInt("REDIS_DB", 0);

  if (redisDb < 0) {
    throw new AppError("REDIS_DB must be zero or greater.", {
      statusCode: 500,
      code: "SERVICE_CONFIG_INVALID"
    });
  }

  const redisUrl = redisPassword
    ? `redis://:${encodeURIComponent(redisPassword)}@${redisAddr}/${redisDb}`
    : `redis://${redisAddr}/${redisDb}`;

  return {
    serviceName: "worker-service",
    port,
    databaseUrl: readRequiredEnv("DATABASE_URL"),
    redisUrl,
    analysisQueueName: readOptionalEnv("ANALYSIS_QUEUE_NAME", "analysis_jobs"),
    analysisDeadLetterQueueName: readOptionalEnv("ANALYSIS_DEAD_LETTER_QUEUE_NAME", "analysis_jobs_dead"),
    workerConcurrency: readPositiveInt("WORKER_CONCURRENCY", 3),
    maxJobAttempts: readPositiveInt("MAX_JOB_ATTEMPTS", 3),
    retryDelayMs: readPositiveInt("RETRY_DELAY_SECONDS", 30) * 1000,
    giteaBaseUrl: readRequiredEnv("GITEA_BASE_URL"),
    giteaBotToken: readRequiredEnv("GITEA_BOT_TOKEN"),
    aiBaseUrl: readRequiredEnv("AI_BASE_URL"),
    aiApiKey: readRequiredEnv("AI_API_KEY"),
    aiModel: readOptionalEnv("AI_MODEL", "gpt-4.1-mini"),
    aiTimeoutMs: readPositiveInt("AI_TIMEOUT_SECONDS", 60) * 1000
  };
}
