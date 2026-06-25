import { buildNotificationService } from "./app.ts";

const app = buildNotificationService();

try {
  await app.listen({ port: app.config.port, host: "0.0.0.0" });
  app.serviceLogger.info("notification-service started", { port: app.config.port });
} catch (error) {
  app.serviceLogger.error("notification-service failed to start", {
    error: error instanceof Error ? error.message : "Unknown error"
  });
  process.exit(1);
}
