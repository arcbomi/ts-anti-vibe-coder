import type { FastifyRequest } from "fastify";
import { UnauthorizedError } from "../errors/UnauthorizedError.js";

export function requireInternalServiceAuth(
  request: Pick<FastifyRequest, "headers">,
  input: {
    internalServiceToken?: string;
  }
) {
  const providedToken = readInternalServiceToken(request.headers);
  const expectedToken = String(input.internalServiceToken ?? "").trim();

  if (!expectedToken || providedToken !== expectedToken) {
    throw new UnauthorizedError("Internal service authentication is required.");
  }
}

function readInternalServiceToken(headers: Record<string, unknown>) {
  const headerToken = typeof headers["x-internal-service-token"] === "string" ? headers["x-internal-service-token"] : "";
  if (headerToken.trim()) {
    return headerToken.trim();
  }

  const authorization = typeof headers.authorization === "string" ? headers.authorization : "";
  return authorization.replace(/^Bearer\s+/i, "").trim();
}
