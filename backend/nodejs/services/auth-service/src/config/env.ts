import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type { AuthServiceConfig } from "../shared/contracts/auth.js";

const DEFAULT_TOMORROW_SIGNIN_ENDPOINT = "https://01.tomorrow-school.ai/api/auth/signin";
const DEFAULT_TOMORROW_REFERRER = "https://01.tomorrow-school.ai/?show-password=1";
const DEFAULT_TOMORROW_PROFILE_PATH = "/intra/astanahub/profile?event=96";

function parsePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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

export function loadAuthServiceConfig(): AuthServiceConfig {
  const appEnv = String(process.env.APP_ENV ?? process.env.NODE_ENV ?? "development").trim();
  const jwtSecret = requireEnv("JWT_SECRET");

  return {
    serviceName: "auth-service",
    port: parsePositiveNumber(process.env.AUTH_SERVICE_PORT ?? process.env.AUTH_SERVICE_HTTP_PORT, 3005),
    appEnv,
    credentialSecret: String(process.env.AUTH_CREDENTIAL_SECRET ?? jwtSecret).trim(),
    userService: {
      baseUrl: String(process.env.USER_SERVICE_URL ?? "http://localhost:3002").trim(),
      internalToken: requireEnv("INTERNAL_SERVICE_TOKEN", "local-internal-token"),
      timeoutMs: parsePositiveNumber(process.env.USER_SERVICE_TIMEOUT_SECONDS, 5) * 1000
    },
    jwt: {
      secret: jwtSecret,
      accessTokenTtlMinutes: parsePositiveNumber(process.env.JWT_ACCESS_TOKEN_TTL_MINUTES, 60)
    },
    tomorrowSchool: {
      endpoint: requireEnv("TOMORROW_SCHOOL_AUTH_ENDPOINT", DEFAULT_TOMORROW_SIGNIN_ENDPOINT),
      graphQlEndpoint: String(process.env.TOMORROW_SCHOOL_GRAPHQL_ENDPOINT ?? "").trim(),
      graphQlRole: String(process.env.TOMORROW_SCHOOL_GRAPHQL_ROLE ?? "user").trim(),
      timeoutMs: parsePositiveNumber(process.env.TOMORROW_SCHOOL_AUTH_TIMEOUT_SECONDS, 10) * 1000,
      referrer: String(process.env.TOMORROW_SCHOOL_AUTH_REFERRER ?? DEFAULT_TOMORROW_REFERRER).trim(),
      xJwtToken: String(process.env.TOMORROW_SCHOOL_AUTH_X_JWT_TOKEN ?? "undefined").trim(),
      sessionId: String(process.env.TOMORROW_SCHOOL_AUTH_SESSION_ID ?? "").trim(),
      profilePath: String(process.env.TOMORROW_PROFILE_PATH ?? DEFAULT_TOMORROW_PROFILE_PATH).trim()
    },
    devSeedUser: {
      enabled: appEnv === "development",
      name: String(process.env.DEV_SEED_USER_NAME ?? "Student User").trim(),
      email: String(process.env.DEV_SEED_USER_EMAIL ?? "student@example.com").trim(),
      password: String(process.env.DEV_SEED_USER_PASSWORD ?? "correct-password")
    }
  };
}
