import type { FastifyInstance } from "fastify";
import { createLogger, createServiceApp } from "../../../packages/microservice-sdk/src/index.js";
import { UserServiceClient } from "./clients/userServiceClient.js";
import { loadAuthServiceConfig } from "./config/env.js";
import { AuthController } from "./controllers/authController.js";
import { registerErrorHandler } from "./middlewares/errorHandler.js";
import { registerAuthServiceRoutes } from "./routes/index.js";
import { AuthService } from "./services/authService.js";
import { TomorrowSchoolAuthService } from "./services/tomorrowSchoolAuthService.js";
import type { AuthServiceConfig } from "./types/auth.js";

export type AuthServiceApp = FastifyInstance & {
  config: AuthServiceConfig;
  serviceLogger: ReturnType<typeof createLogger>;
};

export async function buildAuthService(): Promise<AuthServiceApp> {
  const config = loadAuthServiceConfig();
  const logger = createLogger(config.serviceName);
  const tomorrowSchoolAuthService = new TomorrowSchoolAuthService(config.tomorrowSchool);
  const userService = new UserServiceClient(config.userService);
  const authService = new AuthService({
    userService,
    config,
    authenticator: tomorrowSchoolAuthService,
    logger
  });
  const authController = new AuthController({ authService });

  if (config.devSeedUser.enabled) {
    const seededUser = await authService.ensureDevSeedUser(config.devSeedUser);
    if (seededUser) {
      logger.info("dev seed user ready", { email: seededUser.user.email });
    }
  }

  const app = createServiceApp({
    serviceName: config.serviceName,
    logger,
    registerRoutes(fastify) {
      registerAuthServiceRoutes(fastify, { authController, authService });
    },
    setErrorHandler: registerErrorHandler
  });

  app.decorate("config", config);

  return app as unknown as AuthServiceApp;
}
