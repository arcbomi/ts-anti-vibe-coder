import type { FastifyInstance } from "fastify";
import { createLogger, createServiceApp } from "../../../packages/microservice-sdk/src/index.js";
import { loadTomorrowServiceConfig } from "./config/env.js";
import { registerTomorrowServiceRoutes } from "./routes/index.js";
import { registerErrorHandler } from "./middlewares/errorHandler.js";
import { TomorrowRepository } from "./repositories/tomorrowRepository.js";
import { TomorrowProjectDiscoveryService } from "./services/tomorrowProjectDiscoveryService.js";
import { TomorrowController } from "./controllers/tomorrowController.js";
import type { TomorrowAppConfig } from "./types/tomorrow.js";

export type TomorrowServiceApp = FastifyInstance & {
  config: TomorrowAppConfig;
  serviceLogger: ReturnType<typeof createLogger>;
};

export function buildTomorrowService(): TomorrowServiceApp {
  const config = loadTomorrowServiceConfig();
  const logger = createLogger(config.serviceName);
  const repository = new TomorrowRepository(config.tomorrow);
  const discoveryService = new TomorrowProjectDiscoveryService({
    repository,
    config: config.tomorrow
  });
  const tomorrowController = new TomorrowController({
    discoveryService
  });

  const app = createServiceApp({
    serviceName: config.serviceName,
    logger,
    registerRoutes(fastify) {
      registerTomorrowServiceRoutes(fastify, { tomorrowController });
    },
    setErrorHandler: registerErrorHandler
  }) as unknown as TomorrowServiceApp;

  app.decorate("config", config);

  return app;
}
