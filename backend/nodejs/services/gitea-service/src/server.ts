import { buildGiteaService } from "./app.js";

const app = await buildGiteaService();
const port = app.config.port;
const host = "0.0.0.0";

try {
  await app.listen({ port, host });
  app.serviceLogger.info("gitea-service started", { port, host });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  app.serviceLogger.error("gitea-service failed to start", { error: message });
  process.exit(1);
}
