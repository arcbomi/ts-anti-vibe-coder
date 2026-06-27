import { createFastifyApp, createLogger } from "@backend/microservice-sdk";
import { loadGiteaServiceConfig } from "./config/env.js";
import { GiteaController } from "./controllers/giteaController.js";
import { registerErrorHandler } from "./middlewares/errorHandler.js";
import { requireGatewayAuth } from "./middlewares/auth.js";
import { PostgresGiteaRepository } from "./repositories/giteaRepository.js";
import { PostgresTomorrowConnectionRepository } from "./repositories/tomorrowConnectionRepository.js";
import { registerGiteaServiceRoutes } from "./routes/index.js";
import { RedisAnalysisQueuePublisher } from "./services/analysisQueuePublisher.js";
import { GiteaApiClient } from "./services/giteaApiClient.js";
import { GiteaService } from "./services/giteaService.js";
import { TomorrowProjectDiscoveryClient } from "./services/tomorrowProjectDiscoveryClient.js";
import type { GiteaServiceApp } from "./types/service.js";
import { FileFilter } from "./utils/fileFilter.js";

export async function buildGiteaService(): Promise<GiteaServiceApp> {
  const config = loadGiteaServiceConfig();
  const logger = createLogger({ serviceName: config.serviceName });

  const repositoryStore = new PostgresGiteaRepository(config.databaseUrl);
  await repositoryStore.ensureSchema();

  const tomorrowConnectionStore = new PostgresTomorrowConnectionRepository(config.databaseUrl);
  const giteaApiClient = new GiteaApiClient(config.gitea);
  const analysisQueuePublisher = new RedisAnalysisQueuePublisher(config.redis);
  const tomorrowProjectDiscoveryClient = new TomorrowProjectDiscoveryClient(config.tomorrow.serviceUrl);
  const fileFilter = new FileFilter(config.files.maxFileSizeBytes);
  const service = new GiteaService({
    repositoryStore,
    tomorrowConnectionStore,
    giteaApiClient,
    analysisQueuePublisher,
    tomorrowProjectDiscoveryClient,
    fileFilter,
    config,
    logger
  });
  const controller = new GiteaController(service);

  const app = createFastifyApp({
    serviceName: config.serviceName,
    logger,
    registerRoutes(fastify) {
      registerGiteaServiceRoutes(fastify, {
        controller,
        requireAuth: requireGatewayAuth()
      });
    },
    registerErrorHandler
  }) as unknown as GiteaServiceApp;

  app.decorate("config", config);
  return app;
}
