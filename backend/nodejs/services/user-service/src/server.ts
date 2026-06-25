import { buildUserService } from "./app.js";

const app = await buildUserService();

try {
  await app.listen({ port: app.config.port, host: "0.0.0.0" });
  app.serviceLogger.info("user-service started", { port: app.config.port });
} catch (error) {
  app.serviceLogger.error("user-service failed to start", {
    error: error instanceof Error ? error.message : "Unknown error"
  });
  process.exit(1);
}
