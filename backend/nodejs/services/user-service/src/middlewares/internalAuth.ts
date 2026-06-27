import { AppError } from "@backend/microservice-sdk";
import type { UserServiceConfig } from "../types/service.js";

export async function requireInternalToken(
  request: { headers: Record<string, unknown> },
  config: UserServiceConfig
) {
  const providedToken = readToken(request.headers);
  if (!config.internalServiceToken || providedToken !== config.internalServiceToken) {
    throw new AppError("Internal service authentication is required.", {
      statusCode: 401,
      code: "UNAUTHORIZED"
    });
  }
}

function readToken(headers: Record<string, unknown>) {
  const headerToken = typeof headers["x-internal-service-token"] === "string" ? headers["x-internal-service-token"] : "";
  if (headerToken.trim()) {
    return headerToken.trim();
  }

  const authorization = typeof headers.authorization === "string" ? headers.authorization : "";
  return authorization.replace(/^Bearer\s+/i, "").trim();
}
