import type { FastifyInstance } from "fastify";
import { isAppError } from "../../../../packages/microservice-sdk/src/index.js";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    const statusCode = isAppError(error) ? error.statusCode : 500;
    const code = isAppError(error) ? error.code : "INTERNAL_ERROR";
    const message = error instanceof Error ? error.message : "Internal server error.";

    (
      request.server as FastifyInstance & {
        serviceLogger?: {
          error(message: string, metadata?: unknown): void;
        };
      }
    ).serviceLogger?.error("request failed", {
      path: request.url,
      method: request.method,
      error: message
    });

    reply.code(statusCode).send({
      success: false,
      data: null,
      error: {
        code,
        message
      }
    });
  });
}
