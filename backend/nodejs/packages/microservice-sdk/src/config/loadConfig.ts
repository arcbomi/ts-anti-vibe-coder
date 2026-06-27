import { AppError } from "../errors/AppError.js";
import type { AppConfig } from "./AppConfig.js";

const DEFAULT_PORTS: Record<string, number> = {
  "api-gateway": 8080,
  "tomorrow-service": 3001,
  "user-service": 3002,
  "notification-service": 3003,
  "relationship-service": 3004,
  "auth-service": 3005,
  "exam-service": 3006,
  "worker-service": 3007,
  "gitea-service": 8082
};

const DEFAULT_TOMORROW_AUTH_ENDPOINT = "https://01.tomorrow-school.ai/api/auth/signin";
const DEFAULT_TOMORROW_BASE_URL = "https://01.tomorrow-school.ai";
const DEFAULT_TOMORROW_REFERRER = "https://01.tomorrow-school.ai/?show-password=1";
const DEFAULT_TOMORROW_PROFILE_PATH = "/intra/astanahub/profile?event=96";
const DEFAULT_KAFKA_BROKERS = "redpanda:9092";

function toServiceEnvPrefix(serviceName: string) {
  return serviceName.trim().replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
}

function readString(value: string | undefined, fallback = "") {
  return String(value ?? fallback).trim();
}

function requireEnv(name: string, fallback = "") {
  const value = readString(process.env[name], fallback);
  if (!value) {
    throw new AppError(`Missing environment variable: ${name}`, {
      statusCode: 500,
      code: "CONFIGURATION_ERROR"
    });
  }

  return value;
}

function readPort(serviceName: string) {
  const servicePrefix = toServiceEnvPrefix(serviceName);
  const rawValue =
    process.env[`${servicePrefix}_PORT`] ?? process.env[`${servicePrefix}_HTTP_PORT`] ?? String(DEFAULT_PORTS[serviceName] ?? 3000);
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new AppError(`Invalid port for ${serviceName}: ${rawValue}`, {
      statusCode: 500,
      code: "CONFIGURATION_ERROR"
    });
  }

  return value;
}

function readDuration(value: string | undefined) {
  const normalized = readString(value);
  return normalized || undefined;
}

function readTimeoutMs(value: string | undefined, fallbackSeconds: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackSeconds * 1000;
  }

  return Math.floor(parsed * 1000);
}

function readKafkaBrokers(value: string | undefined) {
  const brokers = readString(value, DEFAULT_KAFKA_BROKERS)
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);

  if (brokers.length === 0) {
    throw new AppError("KAFKA_BROKERS must contain at least one broker.", {
      statusCode: 500,
      code: "CONFIGURATION_ERROR"
    });
  }

  return brokers;
}

export function loadConfig(serviceName: string): AppConfig {
  const normalizedServiceName = serviceName.trim();
  if (!normalizedServiceName) {
    throw new AppError("serviceName is required.", {
      statusCode: 500,
      code: "CONFIGURATION_ERROR"
    });
  }

  const appEnv = readString(process.env.APP_ENV ?? process.env.NODE_ENV, "development");

  return {
    serviceName: normalizedServiceName,
    appEnv,
    port: readPort(normalizedServiceName),
    jwtSecret: requireEnv("JWT_SECRET"),
    jwtAccessTokenTtl: readDuration(process.env.JWT_ACCESS_TOKEN_TTL ?? withMinutesFallback(process.env.JWT_ACCESS_TOKEN_TTL_MINUTES)),
    kafkaBrokers: readKafkaBrokers(process.env.KAFKA_BROKERS),
    internalServiceToken: readString(process.env.INTERNAL_SERVICE_TOKEN, "local-internal-token") || undefined,
    userServiceBaseUrl: readString(process.env.USER_SERVICE_URL, "http://localhost:3002") || undefined,
    userServiceTimeoutMs: readTimeoutMs(process.env.USER_SERVICE_TIMEOUT_SECONDS, 5),
    tomorrowSchoolBaseUrl: readString(process.env.TOMORROW_BASE_URL, DEFAULT_TOMORROW_BASE_URL) || undefined,
    tomorrowSchoolAuthEndpoint:
      readString(process.env.TOMORROW_SCHOOL_AUTH_ENDPOINT, DEFAULT_TOMORROW_AUTH_ENDPOINT) || undefined,
    tomorrowSchoolTimeoutMs: readTimeoutMs(process.env.TOMORROW_SCHOOL_AUTH_TIMEOUT_SECONDS, 10),
    tomorrowSchoolReferrer: readString(process.env.TOMORROW_SCHOOL_AUTH_REFERRER, DEFAULT_TOMORROW_REFERRER) || undefined,
    tomorrowSchoolXJwtToken: readString(process.env.TOMORROW_SCHOOL_AUTH_X_JWT_TOKEN, "undefined") || undefined,
    tomorrowSchoolSessionId: readString(process.env.TOMORROW_SCHOOL_AUTH_SESSION_ID) || undefined,
    tomorrowSchoolGraphQlEndpoint: readString(process.env.TOMORROW_SCHOOL_GRAPHQL_ENDPOINT) || undefined,
    tomorrowSchoolGraphQlRole: readString(process.env.TOMORROW_SCHOOL_GRAPHQL_ROLE, "user") || undefined,
    tomorrowSchoolProfilePath: readString(process.env.TOMORROW_PROFILE_PATH, DEFAULT_TOMORROW_PROFILE_PATH) || undefined,
    logLevel: readString(process.env.LOG_LEVEL, appEnv === "development" ? "debug" : "info") || undefined
  };
}

function withMinutesFallback(value: string | undefined) {
  const minutes = readString(value);
  return minutes ? `${minutes}m` : "";
}
