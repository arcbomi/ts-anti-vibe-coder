import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type { ApiGatewayConfig } from "../types/service.js";
import { normalizeBaseUrl } from "../utils/targetUrl.js";

const DEFAULT_PORT = 8080;

export function loadApiGatewayConfig(env: NodeJS.ProcessEnv = process.env): ApiGatewayConfig {
  const port = parsePort(env.API_GATEWAY_PORT, DEFAULT_PORT);
  const jwtSecret = readRequired(env.JWT_SECRET, "JWT_SECRET");

  return {
    serviceName: "api-gateway",
    port,
    jwtSecret,
    upstreams: {
      auth: normalizeBaseUrl(env.AUTH_SERVICE_BASE_URL ?? "http://localhost:3005"),
      gitea: normalizeBaseUrl(env.GITEA_READER_SERVICE_BASE_URL ?? "http://localhost:8082"),
      question: normalizeBaseUrl(env.QUESTION_SERVICE_BASE_URL ?? "http://localhost:3006/api/v1"),
      exam: normalizeBaseUrl(env.EXAM_SERVICE_BASE_URL ?? "http://localhost:3006/api/v1")
    }
  };
}

function parsePort(rawValue: string | undefined, fallback: number) {
  if (!rawValue?.trim()) {
    return fallback;
  }

  const port = Number(rawValue);
  if (!Number.isInteger(port) || port <= 0) {
    throw new AppError(`Invalid API_GATEWAY_PORT value: ${rawValue}`, {
      statusCode: 500,
      code: "CONFIGURATION_ERROR"
    });
  }

  return port;
}

function readRequired(value: string | undefined, key: string) {
  if (value?.trim()) {
    return value;
  }

  throw new AppError(`${key} is required.`, {
    statusCode: 500,
    code: "CONFIGURATION_ERROR"
  });
}
