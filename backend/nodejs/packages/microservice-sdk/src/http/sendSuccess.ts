import type { FastifyReply } from "fastify";

export function sendSuccess<T>(reply: FastifyReply, data: T, statusCode = 200) {
  return reply.code(statusCode).send({
    success: true,
    data
  });
}
