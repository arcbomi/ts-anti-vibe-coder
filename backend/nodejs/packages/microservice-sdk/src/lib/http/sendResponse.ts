import type { FastifyReply } from "fastify";

export function sendSuccess(reply: FastifyReply, payload: unknown, statusCode = 200) {
  return reply.code(statusCode).send({
    success: true,
    data: payload
  });
}
