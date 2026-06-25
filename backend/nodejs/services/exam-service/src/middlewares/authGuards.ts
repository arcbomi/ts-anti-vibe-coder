import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type { ExamServiceConfig } from "../types/service.js";

export async function requireUser(request: { headers: Record<string, unknown>; userContext?: { userId: string } }) {
  const header = request.headers["x-user-id"];
  const userId = typeof header === "string" ? header.trim() : "";
  if (!userId) {
    throw new AppError("Authentication is required.", {
      statusCode: 401,
      code: "UNAUTHORIZED"
    });
  }

  request.userContext = { userId };
}

export async function requireInternalToken(
  request: { headers: Record<string, unknown> },
  config: ExamServiceConfig
) {
  const providedToken = readToken(request.headers);
  if (!config.internalToken || providedToken !== config.internalToken) {
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
