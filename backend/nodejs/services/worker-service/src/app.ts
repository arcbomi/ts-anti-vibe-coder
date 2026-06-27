import type { FastifyInstance } from "fastify";
import { createFastifyApp, createLogger } from "@backend/microservice-sdk";
import { loadWorkerServiceConfig } from "./config/env.ts";
import { WorkerController } from "./controllers/workerController.ts";
import { registerErrorHandler } from "./middlewares/errorHandler.ts";
import { AIRepository } from "./repositories/aiRepository.ts";
import { AnalysisJobRepository } from "./repositories/analysisJobRepository.ts";
import { GiteaRepository } from "./repositories/giteaRepository.ts";
import { QueueRepository } from "./repositories/queueRepository.ts";
import { registerWorkerServiceRoutes } from "./routes/index.ts";
import { AnalysisJobService } from "./services/analysisJobService.ts";
import { WorkerRuntimeService } from "./services/workerRuntimeService.ts";
import type { WorkerServiceApp } from "./types/service.ts";

export async function buildWorkerService(): Promise<WorkerServiceApp> {
  const config = loadWorkerServiceConfig();
  const logger = createLogger({ serviceName: config.serviceName });
  const analysisJobRepository = new AnalysisJobRepository(config.databaseUrl);
  await analysisJobRepository.connect();
  await analysisJobRepository.ensureSchema();

  const queueRepository = new QueueRepository(config.redisUrl, logger);
  await queueRepository.connect();

  const giteaRepository = new GiteaRepository(config);
  const aiRepository = new AIRepository(config);
  const analysisJobService = new AnalysisJobService({
    config,
    logger,
    analysisJobRepository,
    giteaRepository,
    aiRepository
  });
  const workerRuntimeService = new WorkerRuntimeService({
    config,
    logger,
    queueRepository,
    analysisJobRepository,
    analysisJobService
  });
  const workerController = new WorkerController(workerRuntimeService);

  const app = createFastifyApp({
    serviceName: config.serviceName,
    logger,
    registerRoutes(fastify: FastifyInstance) {
      registerWorkerServiceRoutes(fastify, { workerController });
    },
    registerErrorHandler
  }) as unknown as WorkerServiceApp;

  app.decorate("config", config);

  app.addHook("onReady", async () => {
    await workerRuntimeService.start();
  });

  app.addHook("onClose", async () => {
    await workerRuntimeService.stop();
    await queueRepository.close();
    await analysisJobRepository.close();
  });

  return app;
}
