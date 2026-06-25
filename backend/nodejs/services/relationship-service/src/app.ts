import type { FastifyInstance } from "fastify";
import { createLogger, createServiceApp } from "../../../packages/microservice-sdk/src/index.js";
import { loadRelationshipServiceConfig } from "./config/env.ts";
import { StatusController } from "./controllers/statusController.ts";
import { registerErrorHandler } from "./middlewares/errorHandler.ts";
import { ServiceStatusRepository } from "./repositories/statusRepository.ts";
import { registerRelationshipServiceRoutes } from "./routes/index.ts";
import { StatusService } from "./services/statusService.ts";
import type { RelationshipServiceApp } from "./types/service.ts";

export function buildRelationshipService(): RelationshipServiceApp {
  const config = loadRelationshipServiceConfig();
  const logger = createLogger(config.serviceName);
  const statusRepository = new ServiceStatusRepository(config.serviceName, "relationship");
  const statusService = new StatusService(statusRepository);
  const statusController = new StatusController(statusService);

  const app = createServiceApp({
    serviceName: config.serviceName,
    logger,
    registerRoutes(fastify: FastifyInstance) {
      registerRelationshipServiceRoutes(fastify, { statusController });
    },
    setErrorHandler: registerErrorHandler
  }) as unknown as RelationshipServiceApp;

  app.decorate("config", config);

  return app;
}
