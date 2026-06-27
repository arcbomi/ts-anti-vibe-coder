import type { FastifyInstance } from "fastify";
import {
  attachInternalAuthContext,
  createEventBus,
  createFastifyApp,
  createLogger,
  createTomorrowSchoolAuthClient,
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

export type AuthServiceApp = FastifyInstance & {
  config: ReturnType<typeof loadConfig>;
};

export async function buildAuthService(): Promise<AuthServiceApp> {
  const config = loadConfig("auth-service");
  const logger = createLogger(config);
  const tomorrowSchoolAuth = createTomorrowSchoolAuthClient(config);
  const userService = createUserServiceClient(config);
  const accessTokenIssuer = createAccessTokenIssuer(config);
  const eventBus = createEventBus(config);

  const loginUser = createLoginUser({
    tomorrowSchoolAuth,
    userService,
    accessTokenIssuer,
    eventBus,
    logger
  });
  const logoutUser = createLogoutUser({
    eventBus
  });
  const readCurrentUser = createReadCurrentUser({
    userService
  });

  const app = createFastifyApp({
    serviceName: config.serviceName,
    appEnv: config.appEnv,
    logger,
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
  }) as unknown as AuthServiceApp;

  app.decorate("config", config);

  return app;
}
