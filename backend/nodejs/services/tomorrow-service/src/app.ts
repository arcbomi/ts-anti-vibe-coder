import type { FastifyInstance } from "fastify";
import { createFastifyApp, createLogger, loadConfig, readBearerToken, sendSuccess } from "@backend/microservice-sdk";
import { createAuthenticateTomorrowAccount, registerAuthenticateTomorrowAccountRoute } from "./domains/tomorrow/authenticateTomorrowAccount/index.js";
import { createTomorrowAuthClient } from "./domains/tomorrow/authenticateTomorrowAccount/shared/createTomorrowAuthClient.js";
import { createGetSucceededProjectRepos, registerGetSucceededProjectReposRoute } from "./domains/tomorrow/getSucceededProjectRepos/index.js";
import { createTomorrowProjectClient } from "./domains/tomorrow/getSucceededProjectRepos/shared/createTomorrowProjectClient.js";
import { createGetTomorrowUserInformation, registerGetTomorrowUserInformationRoute } from "./domains/tomorrow/getTomorrowUserInformation/index.js";
import { createTomorrowUserClient } from "./domains/tomorrow/getTomorrowUserInformation/shared/createTomorrowUserClient.js";

export type TomorrowServiceApp = FastifyInstance & {
  config: ReturnType<typeof loadConfig>;
  serviceLogger?: ReturnType<typeof createLogger>;
};

export async function buildApp(): Promise<TomorrowServiceApp> {
  const config = loadConfig("tomorrow-service");
  const logger = createLogger({ serviceName: config.serviceName, logLevel: config.logLevel });
  const graphQlEndpoint =
    config.tomorrowSchoolGraphQlEndpoint ?? `${String(config.tomorrowSchoolBaseUrl ?? "").replace(/\/+$/, "")}/api/graphql-engine/v1/graphql`;
  const graphQlRole = config.tomorrowSchoolGraphQlRole ?? "user";
  const timeoutMs = config.tomorrowSchoolTimeoutMs ?? 10_000;

  const tomorrowAuthClient = createTomorrowAuthClient({
    authEndpoint: config.tomorrowSchoolAuthEndpoint ?? "",
    timeoutMs,
    referrer: config.tomorrowSchoolReferrer,
    xJwtToken: config.tomorrowSchoolXJwtToken,
    sessionId: config.tomorrowSchoolSessionId
  });
  const tomorrowUserClient = createTomorrowUserClient({
    graphQlEndpoint,
    graphQlRole,
    timeoutMs
  });
  const tomorrowProjectClient = createTomorrowProjectClient({
    graphQlEndpoint,
    graphQlRole,
    timeoutMs
  });

  const authenticateTomorrowAccount = createAuthenticateTomorrowAccount({
    tomorrowAuthClient
  });
  const getTomorrowUserInformation = createGetTomorrowUserInformation({
    tomorrowUserClient
  });
  const getSucceededProjectRepos = createGetSucceededProjectRepos({
    tomorrowProjectClient
  });

  const app = createFastifyApp({
    serviceName: config.serviceName,
    appEnv: config.appEnv,
    logger,
    swagger: {
      serviceName: config.serviceName,
      title: "Tomorrow Service API",
      description: "Tomorrow School integration service for authentication adapter, Tomorrow user information, and succeeded project repo lookup."
    },
    registerRoutes(fastify) {
      registerAuthenticateTomorrowAccountRoute(fastify, {
        authenticateTomorrowAccount,
        sendSuccess
      });
      registerGetTomorrowUserInformationRoute(fastify, {
        getTomorrowUserInformation,
        getBearerToken: readBearerToken,
        sendSuccess
      });
      registerGetSucceededProjectReposRoute(fastify, {
        getSucceededProjectRepos,
        getBearerToken: readBearerToken,
        sendSuccess
      });
    }
  }) as TomorrowServiceApp;

  app.decorate("config", config);

  return app;
}
