import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { Logger } from "../logger/Logger.js";
import { registerErrorHandler } from "./errorHandler.js";

type CreateFastifyAppOptions = {
  serviceName: string;
  logger?: Logger;
  appEnv?: string;
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

  app.get("/health", async () => ({
    service: options.serviceName,
    status: "ok",
    timestamp: new Date().toISOString()
  }));

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
