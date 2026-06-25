import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isAppError } from "../sdk.ts";

export function registerTemplateErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, _request: FastifyRequest, reply: FastifyReply) => {
    reply.code(isAppError(error) ? error.statusCode : 500).send({
      success: false,
      error: {
        code: isAppError(error) ? error.code : "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unexpected error"
      }
    });
  });
}
