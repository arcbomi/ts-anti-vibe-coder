import type { FastifyInstance } from "fastify";
import type { ApiGatewayApp } from "../types/service.js";

export function registerRequestLifecycle(app: FastifyInstance) {
  app.addHook("onResponse", async (request, reply) => {
    const gatewayApp = app as ApiGatewayApp;
    gatewayApp.serviceLogger.info("request completed", {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode
    });
  });
}
