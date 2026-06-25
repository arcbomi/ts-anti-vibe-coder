import type { FastifyInstance } from "fastify";
import { createLogger, createServiceApp } from "../../../packages/microservice-sdk/src/index.js";
import { loadNotificationServiceConfig } from "./config/env.ts";
import { StatusController } from "./controllers/statusController.ts";
import { registerErrorHandler } from "./middlewares/errorHandler.ts";
import { ServiceStatusRepository } from "./repositories/statusRepository.ts";
import { registerNotificationServiceRoutes } from "./routes/index.ts";
import { StatusService } from "./services/statusService.ts";
import type { NotificationServiceApp } from "./types/service.ts";

export function buildNotificationService(): NotificationServiceApp {
  const config = loadNotificationServiceConfig();
  const logger = createLogger(config.serviceName);
  const statusRepository = new ServiceStatusRepository(config.serviceName, "notification");
  const statusService = new StatusService(statusRepository);
  const statusController = new StatusController(statusService);

  const app = createServiceApp({
    serviceName: config.serviceName,
    logger,
    registerRoutes(fastify: FastifyInstance) {
      registerNotificationServiceRoutes(fastify, { statusController });
    },
    setErrorHandler: registerErrorHandler
  }) as unknown as NotificationServiceApp;

  app.decorate("config", config);

  return app;
}
