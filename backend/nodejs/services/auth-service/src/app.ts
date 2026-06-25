import type { FastifyInstance } from "fastify";
import { createLogger, createServiceApp } from "../../../packages/microservice-sdk/src/index.js";
import { loadAuthServiceConfig } from "./config/env.js";
import { buildAuthDomainModule } from "./domain/auth/module.js";
import { registerErrorHandler } from "./middlewares/errorHandler.js";
import { registerAuthServiceRoutes } from "./routes/index.js";
import type { AuthServiceConfig } from "./shared/contracts/auth.js";

export type AuthServiceApp = FastifyInstance & {
  config: AuthServiceConfig;
  serviceLogger: ReturnType<typeof createLogger>;
};

export async function buildAuthService(): Promise<AuthServiceApp> {
  const config = loadAuthServiceConfig();
  const logger = createLogger(config.serviceName);
  const { authController, authService } = buildAuthDomainModule({ config, logger });

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
