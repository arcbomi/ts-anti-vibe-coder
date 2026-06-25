import type { FastifyInstance } from "fastify";
import { AppError } from "../../../../packages/microservice-sdk/src/index.js";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const code = error instanceof AppError ? error.code : "INTERNAL_SERVER_ERROR";
    const message = error instanceof Error ? error.message : "Unexpected error.";

    request.log.error({ err: error }, "api-gateway request failed");

    reply.code(statusCode).send({
      success: false,
      error: {
        code,
        message
      }
    });
  });
}
