import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type { TomorrowAppConfig } from "../types/tomorrow.js";

const DEFAULT_PROFILE_PATH = "/intra/astanahub/profile?event=96";

function requireEnv(name: string, fallback = "") {
  const value = (process.env[name] ?? fallback).trim();
  if (!value) {
    throw new AppError(`Missing environment variable: ${name}`, {
      statusCode: 500,
      code: "CONFIGURATION_ERROR"
    });
  }

  return value;
}

export function loadTomorrowServiceConfig(): TomorrowAppConfig {
  const serviceName = "tomorrow-service";

  return {
    serviceName,
    port: Number(process.env.TOMORROW_SERVICE_PORT ?? "3001"),
    tomorrow: {
      baseUrl: requireEnv("TOMORROW_BASE_URL"),
      username: (process.env.TOMORROW_USERNAME ?? "dmukhat").trim(),
      password: requireEnv("TOMORROW_PASSWORD"),
      authEndpoint: (process.env.TOMORROW_AUTH_ENDPOINT ?? "").trim(),
      referrer: (process.env.TOMORROW_REFERRER ?? "").trim(),
      xJwtToken: (process.env.TOMORROW_X_JWT_TOKEN ?? "undefined").trim(),
      sessionId: (process.env.TOMORROW_SESSION_ID ?? "").trim(),
      profilePath: (process.env.TOMORROW_PROFILE_PATH ?? DEFAULT_PROFILE_PATH).trim()
    }
  };
}
