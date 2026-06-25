import type { FastifyInstance } from "fastify";

const ALLOWED_HEADERS = "Authorization, Content-Type, X-Requested-With, X-User-Id, X-Request-Id";
const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD";

export function registerCors(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    const origin = typeof request.headers.origin === "string" ? request.headers.origin : "*";
    reply.header("Access-Control-Allow-Origin", origin);
    reply.header("Access-Control-Allow-Methods", ALLOWED_METHODS);
    reply.header("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    reply.header("Access-Control-Allow-Credentials", "true");
    reply.header("Vary", "Origin");

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });
}
