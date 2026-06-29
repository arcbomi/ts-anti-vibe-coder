import type { FastifyInstance } from "fastify";
import { createFastifyApp, createLogger, loadConfig, sendSuccess } from "@backend/microservice-sdk";
import {
  createGetUserById,
  createSaveExternalUser,
  registerGetUserByIdRoute,
  registerSaveExternalUserRoute
} from "./domains/user/index.js";
import { createMongoUserStore } from "./domains/user/store/index.js";

export type UserServiceApp = FastifyInstance & {
  config: ReturnType<typeof loadConfig>;
  serviceLogger?: ReturnType<typeof createLogger>;
};

export async function buildApp(): Promise<UserServiceApp> {
  const config = loadConfig("user-service");
  const logger = createLogger({ serviceName: config.serviceName, logLevel: config.logLevel });
  const userStore = createMongoUserStore({
    config
  });

  await userStore.ensureSchema();

  const saveExternalUser = createSaveExternalUser({
    userStore
  });
  const getUserById = createGetUserById({
    userStore
  });
  const app = createFastifyApp({
    serviceName: config.serviceName,
    appEnv: config.appEnv,
    logger,
    swagger: {
      serviceName: config.serviceName,
      title: "User Service API",
      description: "Internal user service for saving external users and reading user/public user records."
    },
    registerRoutes(fastify) {
      registerSaveExternalUserRoute(fastify, {
        saveExternalUser,
        internalServiceToken: config.internalServiceToken,
        sendSuccess
      });
      registerGetUserByIdRoute(fastify, {
        getUserById,
        internalServiceToken: config.internalServiceToken,
        sendSuccess
      });
    }
  }) as UserServiceApp;

  app.decorate("config", config);

  return app;
}
