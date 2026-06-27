import { NotFoundError, UnauthorizedError, readBearerToken, type AccessTokenVerifier } from "@backend/microservice-sdk";
import type { FastifyInstance } from "fastify";
import type { GatewayRoute } from "./GatewayRoute.js";
import { matchGatewayRoute } from "./matchGatewayRoute.js";
import { proxyRequest } from "./proxyRequest.js";

export async function registerGatewayRoutes(
  app: FastifyInstance,
  deps: {
    routes: GatewayRoute[];
    accessTokenVerifier: AccessTokenVerifier;
    fetchImpl?: typeof fetch;
  }
) {
  app.route({
    method: ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
    url: "/*",
    handler: async (request, reply) => {
      const matched = matchGatewayRoute({
        method: request.method,
        url: request.url,
        routes: deps.routes
      });

      if (!matched) {
        throw new NotFoundError("Route not found.");
      }

      const authenticatedUserId = matched.route.protected
        ? (await authenticateRequest(request.headers.authorization, deps.accessTokenVerifier)).userId
        : undefined;

      const result = await proxyRequest({
        method: request.method,
        upstreamUrl: matched.upstreamUrl,
        headers: request.headers as Record<string, unknown>,
        body: request.body,
        authenticatedUserId,
        fetchImpl: deps.fetchImpl
      });

      for (const [key, value] of Object.entries(result.headers)) {
        if (value !== undefined) {
          reply.header(key, value);
        }
      }

      return reply.status(result.statusCode).send(result.body);
    }
  });
}

async function authenticateRequest(
  authorizationHeader: string | string[] | undefined,
  accessTokenVerifier: AccessTokenVerifier
) {
  const token = readBearerToken(authorizationHeader);

  if (!token) {
    throw new UnauthorizedError("Bearer token is required.");
  }

  return accessTokenVerifier.verifyAccessToken(token);
}
