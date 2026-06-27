import type { FastifyInstance } from "fastify";
import { createFastifyApp, createLogger } from "@backend/microservice-sdk";
import { loadUserServiceConfig } from "./config/env.js";
import { StatusController } from "./controllers/statusController.js";
import { UserController } from "./controllers/userController.js";
import { registerErrorHandler } from "./middlewares/errorHandler.js";
import { buildUserRepository } from "./repositories/index.js";
import { ServiceStatusRepository } from "./repositories/statusRepository.js";
import { registerUserServiceRoutes } from "./routes/index.js";
import { StatusService } from "./services/statusService.js";
import { UserService } from "./services/userService.js";
import type { UserServiceApp } from "./types/service.js";

export async function buildUserService(): Promise<UserServiceApp> {
  const config = loadUserServiceConfig();
  const logger = createLogger({ serviceName: config.serviceName });
  const statusRepository = new ServiceStatusRepository(config.serviceName, "user");
  const userRepository = buildUserRepository(config);
  await userRepository.ensureSchema();
  const statusService = new StatusService(statusRepository);
  const userService = new UserService(userRepository);
  const statusController = new StatusController(statusService);
  const userController = new UserController({ userService });

  const app = createFastifyApp({
    serviceName: config.serviceName,
    logger,
    registerRoutes(fastify: FastifyInstance) {
      registerUserServiceRoutes(fastify, { statusController, userController, config });
    },
    registerErrorHandler
  }) as unknown as UserServiceApp;

  app.decorate("config", config);

  return app;
}
