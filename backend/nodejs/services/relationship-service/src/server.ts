import { buildRelationshipService } from "./app.ts";

const app = buildRelationshipService();

try {
  await app.listen({ port: app.config.port, host: "0.0.0.0" });
  app.serviceLogger.info("relationship-service started", { port: app.config.port });
} catch (error) {
  app.serviceLogger.error("relationship-service failed to start", {
    error: error instanceof Error ? error.message : "Unknown error"
  });
  process.exit(1);
}
