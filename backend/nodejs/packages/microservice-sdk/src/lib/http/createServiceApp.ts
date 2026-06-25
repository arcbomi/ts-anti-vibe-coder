import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

type ServiceLogger = {
  info(message: string, metadata?: unknown): void;
  warn(message: string, metadata?: unknown): void;
  error(message: string, metadata?: unknown): void;
};

type ServiceAppOptions = {
  serviceName: string;
  logger: ServiceLogger;
  registerRoutes(app: FastifyInstance): void;
  setErrorHandler(app: FastifyInstance): void;
};

export function createServiceApp({ serviceName, registerRoutes, setErrorHandler, logger }: ServiceAppOptions) {
  const app = Fastify({
    logger: false
  });

  app.decorate("serviceName", serviceName);
  app.decorate("serviceLogger", logger);

  app.get("/health", async () => ({
    service: serviceName,
    status: "ok",
    timestamp: new Date().toISOString()
  }));

  registerRoutes(app);
  setErrorHandler(app);

  return app;
}
