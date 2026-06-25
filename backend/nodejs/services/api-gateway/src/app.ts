import type { FastifyInstance } from "fastify";
import { createLogger, createServiceApp } from "../../../packages/microservice-sdk/src/index.js";
import { loadApiGatewayConfig } from "./config/env.js";
import { GatewayController } from "./controllers/gatewayController.js";
import { registerCors } from "./middlewares/cors.js";
import { registerErrorHandler } from "./middlewares/errorHandler.js";
import { registerRequestLifecycle } from "./middlewares/requestLifecycle.js";
import { ProxyRepository } from "./repositories/proxyRepository.js";
import { registerApiGatewayRoutes } from "./routes/index.js";
import { GatewayService } from "./services/gatewayService.js";
import type { ApiGatewayApp } from "./types/service.js";
import { HmacJwtValidator } from "./utils/jwt.js";

type BuildApiGatewayOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export async function buildApiGateway(options: BuildApiGatewayOptions = {}): Promise<ApiGatewayApp> {
  const config = loadApiGatewayConfig(options.env);
  const logger = createLogger(config.serviceName);
  const jwtValidator = new HmacJwtValidator({ secret: config.jwtSecret, now: options.now });
  const proxyRepository = new ProxyRepository({ upstreams: config.upstreams, fetchImpl: options.fetchImpl });
  const gatewayService = new GatewayService(proxyRepository);
  const gatewayController = new GatewayController(gatewayService);

  const app = createServiceApp({
    serviceName: config.serviceName,
    logger,
    registerRoutes(fastify: FastifyInstance) {
      registerApiGatewayRoutes(fastify, { gatewayController, jwtValidator });
    },
    setErrorHandler: registerErrorHandler
  });

  registerCors(app);
  registerRequestLifecycle(app);
  app.decorate("config", config);

  return app as unknown as ApiGatewayApp;
}
