import {
  createAccessTokenVerifier,
  createFastifyApp,
  createLogger,
  loadConfig,
  registerErrorHandler,
  sendSuccess,
  type AppConfig,
  type Logger
} from "@backend/microservice-sdk";
import type { FastifyInstance } from "fastify";
import { createGatewayRouteTable, registerGatewayRoutes } from "./gateway/index.js";

type BuildAppOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

type GatewayServiceConfig = AppConfig & {
  authServiceUrl: string;
  giteaReaderServiceUrl: string;
  questionServiceUrl: string;
  examServiceUrl: string;
  frontendOrigin?: string;
};

export type ApiGatewayApp = FastifyInstance & {
  config: GatewayServiceConfig;
  serviceLogger?: Logger;
};

export async function buildApp(options: BuildAppOptions = {}): Promise<ApiGatewayApp> {
  const originalEnv = process.env;
  const env = options.env ?? process.env;

  if (options.env) {
    process.env = {
      ...process.env,
      ...options.env
    };
  }

  try {
    const config = readGatewayConfig(env);
    const logger = createLogger({
      serviceName: config.serviceName,
      logLevel: config.logLevel
    });
    const app = createFastifyApp({
      serviceName: config.serviceName,
      logger,
      appEnv: config.appEnv
    }) as unknown as ApiGatewayApp;

    app.decorate("config", config);

    registerGatewayCors(app, config.frontendOrigin);
    app.get("/healthz", async (_request, reply) => sendSuccess(reply, { status: "ok" }));

    registerErrorHandler(app, {
      appEnv: config.appEnv,
      logger
    });

    const accessTokenVerifier = createAccessTokenVerifier(
      { jwtSecret: config.jwtSecret },
      { now: options.now }
    );
    const routes = createGatewayRouteTable({
      authServiceUrl: config.authServiceUrl,
      giteaReaderServiceUrl: config.giteaReaderServiceUrl,
      questionServiceUrl: config.questionServiceUrl,
      examServiceUrl: config.examServiceUrl
    });

    await registerGatewayRoutes(app, {
      routes,
      accessTokenVerifier,
      fetchImpl: options.fetchImpl
    });

    return app;
  } finally {
    if (options.env) {
      process.env = originalEnv;
    }
  }
}

function readGatewayConfig(env: NodeJS.ProcessEnv): GatewayServiceConfig {
  const config = loadConfig("api-gateway");

  return {
    ...config,
    authServiceUrl: readRequiredUrl(env.AUTH_SERVICE_BASE_URL, "AUTH_SERVICE_BASE_URL", "http://localhost:3005"),
    giteaReaderServiceUrl: readRequiredUrl(
      env.GITEA_READER_SERVICE_BASE_URL,
      "GITEA_READER_SERVICE_BASE_URL",
      "http://localhost:8082"
    ),
    questionServiceUrl: readRequiredUrl(
      env.QUESTION_SERVICE_BASE_URL,
      "QUESTION_SERVICE_BASE_URL",
      "http://localhost:3006/api/v1"
    ),
    examServiceUrl: readRequiredUrl(env.EXAM_SERVICE_BASE_URL, "EXAM_SERVICE_BASE_URL", "http://localhost:3006/api/v1"),
    frontendOrigin: readOptionalString(env.FRONTEND_ORIGIN)
  };
}

function readRequiredUrl(rawValue: string | undefined, key: string, fallback: string) {
  const value = readOptionalString(rawValue) ?? fallback;

  try {
    return new URL(value).toString().replace(/\/+$/, "");
  } catch {
    throw new Error(`${key} must be a valid URL.`);
  }
}

function readOptionalString(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function registerGatewayCors(app: FastifyInstance, frontendOrigin?: string) {
  app.addHook("onRequest", async (request, reply) => {
    const requestOrigin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;
    const allowOrigin = frontendOrigin ?? requestOrigin ?? "*";

    reply.header("Access-Control-Allow-Origin", allowOrigin);
    reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
    reply.header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With, X-User-Id, X-Request-Id");
    reply.header("Access-Control-Allow-Credentials", "true");
    reply.header("Vary", "Origin");

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });
}
