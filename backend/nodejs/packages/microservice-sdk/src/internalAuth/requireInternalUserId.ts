import type { FastifyRequest } from "fastify";
import { UnauthorizedError } from "../errors/UnauthorizedError.js";

export function requireInternalUserId(request: FastifyRequest) {
  const userId = request.auth?.userId?.trim();
  if (!userId) {
    throw new UnauthorizedError("Authenticated internal user context is required.");
  }

  return userId;
}
