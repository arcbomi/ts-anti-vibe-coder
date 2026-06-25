import { buildWorkerService } from "./app.ts";

const app = await buildWorkerService();

try {
  await app.listen({ port: app.config.port, host: "0.0.0.0" });
  app.serviceLogger.info("worker-service started", { port: app.config.port });
} catch (error) {
  app.serviceLogger.error("worker-service failed to start", {
    error: error instanceof Error ? error.message : "Unknown error"
  });
  process.exit(1);
}
