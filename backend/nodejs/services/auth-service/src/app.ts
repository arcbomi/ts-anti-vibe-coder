import type { FastifyInstance } from "fastify";
import {
  attachInternalAuthContext,
  createEventBus,
  createFastifyApp,
  createLogger,
  createUserServiceClient,
  requireInternalUserId,
  loadConfig,
  sendSuccess
} from "@backend/microservice-sdk";
import {
  createAccessTokenIssuer,
  createLoginUser,
  createLogoutUser,
  createReadCurrentUser,
  registerLoginUserRoute,
  registerLogoutUserRoute,
  registerReadCurrentUserRoute
} from "./domains/auth/index.js";
import { createTomorrowServiceClient } from "./domains/auth/loginUser/shared/createTomorrowServiceClient.js";
import { createTomorrowTokenStore } from "./domains/auth/loginUser/shared/createTomorrowTokenStore.js";

export type AuthServiceApp = FastifyInstance & {
  config: ReturnType<typeof loadConfig>;
};

export async function buildAuthService(): Promise<AuthServiceApp> {
  const config = loadConfig("auth-service");
  const logger = createLogger(config);
  const tomorrowService = createTomorrowServiceClient(config);
  const tomorrowTokenStore = createTomorrowTokenStore(config);
  const userService = createUserServiceClient(config);
  const accessTokenIssuer = createAccessTokenIssuer(config);
  const eventBus = createEventBus(config);

  const loginUser = createLoginUser({
    tomorrowService,
    userService,
    tomorrowTokenStore,
    accessTokenIssuer,
    eventBus,
    logger
  });
  const logoutUser = createLogoutUser({
    eventBus,
    tomorrowTokenStore
  });
  const readCurrentUser = createReadCurrentUser({
    userService
  });

  const app = createFastifyApp({
    serviceName: config.serviceName,
    appEnv: config.appEnv,
    logger,
    swagger: {
      serviceName: config.serviceName,
      title: "Auth Service API",
      description: "Authentication service for signin, token issuance, refresh, logout, and current user auth flows."
    },
    registerRoutes(fastify: FastifyInstance) {
      registerLoginUserRoute(fastify, {
        loginUser,
        sendSuccess
      });
      registerLogoutUserRoute(fastify, {
        logoutUser,
        requireAuth: attachInternalAuthContext,
        getCurrentUserId: requireInternalUserId,
        sendSuccess
      });
      registerReadCurrentUserRoute(fastify, {
        readCurrentUser,
        requireAuth: attachInternalAuthContext,
        getCurrentUserId: requireInternalUserId,
        sendSuccess
      });
    }
  }) as AuthServiceApp;

  app.decorate("config", config);

  return app;
}
