import type { FastifyInstance } from "fastify";
import { isAppError } from "@backend/microservice-sdk";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const statusCode = isAppError(error) ? error.statusCode : 500;
    const code = isAppError(error) ? error.code : "INTERNAL_ERROR";
    const message = error instanceof Error ? error.message : "Internal server error.";

    (
      app as FastifyInstance & {
        serviceLogger: {
          error(message: string, metadata?: unknown): void;
        };
      }
    ).serviceLogger.error("worker-service request failed", {
      path: request.url,
      method: request.method,
      error: message
    });

    reply.code(statusCode).send({
      success: false,
      error: {
        code,
        message
      }
    });
  });
}
