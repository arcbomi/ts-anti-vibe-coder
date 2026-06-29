import { AppError } from "@backend/microservice-sdk";
import type { TomorrowAuthClient } from "./TomorrowAuthClient.js";
import { tomorrowAuthHeaders } from "./tomorrowAuthHeaders.js";
import { readTomorrowJwtClaims } from "./tomorrowJwtClaims.js";
import { parseTomorrowTokenResponse } from "./tomorrowTokenParser.js";

export function createTomorrowAuthClient(config: {
  authEndpoint: string;
  timeoutMs: number;
  referrer?: string;
  xJwtToken?: string;
  sessionId?: string;
}): TomorrowAuthClient {
  return {
    async authenticate(input) {
      if (!config.authEndpoint.trim()) {
        throw new AppError("Tomorrow authentication provider is unavailable.", {
          statusCode: 502,
          code: "TOMORROW_AUTH_PROVIDER_UNAVAILABLE"
        });
      }

      const response = await fetch(config.authEndpoint, {
        method: "POST",
        headers: tomorrowAuthHeaders(input, config),
        signal: AbortSignal.timeout(config.timeoutMs)
      });

      const rawBody = await response.text();
      const parsed = parseTomorrowTokenResponse(rawBody);

      if (response.status === 401 || response.status === 403 || parsed.responseError) {
        throw new AppError("Invalid Tomorrow credentials", {
          statusCode: 401,
          code: "UNAUTHORIZED"
        });
      }

      if (!response.ok || !parsed.accessToken) {
        throw new AppError("Tomorrow authentication provider is unavailable.", {
          statusCode: 502,
          code: "TOMORROW_AUTH_PROVIDER_UNAVAILABLE"
        });
      }

      const claims = readTomorrowJwtClaims(parsed.accessToken);

      return {
        accessToken: parsed.accessToken,
        expiresAt: parsed.expiresAt ?? toExpiresAt(claims.exp),
        tokenType: parsed.tokenType ?? "Bearer"
      };
    }
  };
}

function toExpiresAt(exp?: number) {
  if (!Number.isFinite(exp) || !exp) {
    return undefined;
  }

  return new Date(exp * 1000).toISOString();
}
