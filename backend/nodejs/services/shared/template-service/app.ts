import type { FastifyInstance } from "fastify";
import { registerTemplateRoutes } from "./routes/index.ts";
import { registerTemplateErrorHandler } from "./middlewares/errorHandler.ts";
import { HealthController } from "./controllers/healthController.ts";
import { HealthService } from "./services/healthService.ts";
import { HealthRepository } from "./repositories/healthRepository.ts";
import { createLogger, createServiceApp } from "./sdk.ts";
import type { ServiceApp, ServiceConfig } from "./types.ts";

export function buildTemplateService({ serviceName, port }: ServiceConfig): ServiceApp {
  const logger = createLogger(serviceName);
  const healthRepository = new HealthRepository(serviceName);
  const healthService = new HealthService(healthRepository);
  const healthController = new HealthController(healthService);

  const app = createServiceApp({
    serviceName,
    logger,
    registerRoutes(fastify: FastifyInstance) {
      registerTemplateRoutes(fastify, { healthController });
    },
    setErrorHandler: registerTemplateErrorHandler
  }) as ServiceApp;

  app.decorate("config", { serviceName, port });

  return app;
}
