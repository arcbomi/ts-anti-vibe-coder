import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { Logger } from "../logger/Logger.js";
import { registerErrorHandler } from "./errorHandler.js";
import { registerSwagger, type RegisterSwaggerOptions } from "./registerSwagger.js";

type CreateFastifyAppOptions = {
  serviceName: string;
  logger?: Logger;
  appEnv?: string;
  swagger?: RegisterSwaggerOptions;
  registerRoutes?: (app: FastifyInstance) => void;
  registerErrorHandler?: (app: FastifyInstance) => void;
};

declare module "fastify" {
  interface FastifyInstance {
    serviceName: string;
    serviceLogger?: Logger;
  }
}

export function createFastifyApp(options: CreateFastifyAppOptions) {
  const app = Fastify({
    logger: false
  });

  app.decorate("serviceName", options.serviceName);
  app.decorate("serviceLogger", options.logger);

  if (options.swagger) {
    void registerSwagger(app, options.swagger);
  }

  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Health check",
        description: "Returns service health information.",
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["service", "status", "timestamp"],
            properties: {
              service: { type: "string" },
              status: { type: "string", enum: ["ok"] },
              timestamp: { type: "string", format: "date-time" }
            }
          }
        }
      }
    },
    async () => ({
      service: options.serviceName,
      status: "ok",
      timestamp: new Date().toISOString()
    })
  );

  options.registerRoutes?.(app);

  if (options.registerErrorHandler) {
    options.registerErrorHandler(app);
  } else {
    registerErrorHandler(app, {
      appEnv: options.appEnv,
      logger: options.logger
    });
  }

  return app;
}
