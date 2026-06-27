import type { FastifyRequest } from "fastify";

export function readInternalUserContext(request: FastifyRequest) {
  const authenticatedHeader = request.headers["x-authenticated"];
  const isAuthenticated =
    typeof authenticatedHeader === "string" && authenticatedHeader.trim().toLowerCase() === "true";
  const userIdHeader = request.headers["x-user-id"];
  const userId = typeof userIdHeader === "string" ? userIdHeader.trim() : "";

  if (!isAuthenticated || !userId) {
    return null;
  }

  return {
    userId
  };
}
