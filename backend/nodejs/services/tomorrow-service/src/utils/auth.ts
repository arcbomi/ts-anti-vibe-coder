import { AppError } from "../../../../packages/microservice-sdk/src/index.js";

export function toBasicAuthorization(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

export function extractAuthToken(rawBody: string) {
  const trimmed = String(rawBody ?? "").trim();
  if (!trimmed) {
    return { token: "", responseError: "" };
  }

  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    try {
      return {
        token: (JSON.parse(trimmed) as string).trim(),
        responseError: ""
      };
    } catch {
      return { token: "", responseError: "" };
    }
  }

  try {
    const payload = JSON.parse(trimmed) as Record<string, unknown>;
    return {
      token: String(payload.jwt ?? payload.access_token ?? payload.token ?? "").trim(),
      responseError: String(payload.error ?? "").trim()
    };
  } catch {
    return { token: "", responseError: "" };
  }
}

export function extractUserIdFromJwt(token: string) {
  const parts = String(token ?? "").trim().split(".");
  if (parts.length < 2) {
    throw new AppError("JWT does not contain a valid payload", {
      statusCode: 500,
      code: "JWT_PARSE_ERROR"
    });
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      sub?: string | number;
      "https://hasura.io/jwt/claims"?: {
        "x-hasura-user-id"?: string | number;
      };
    };
    const candidates = [
      payload.sub,
      payload["https://hasura.io/jwt/claims"]?.["x-hasura-user-id"]
    ];

    for (const candidate of candidates) {
      const parsed = Number(candidate);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (error) {
    throw new AppError(`JWT parse error: ${error instanceof Error ? error.message : String(error)}`, {
      statusCode: 500,
      code: "JWT_PARSE_ERROR"
    });
  }

  throw new AppError("JWT does not contain a user id", {
    statusCode: 500,
    code: "JWT_PARSE_ERROR"
  });
}
