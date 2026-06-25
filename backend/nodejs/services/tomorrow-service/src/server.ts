import { buildTomorrowService } from "./app.js";

const app = buildTomorrowService();
const port = app.config.port;
const host = "0.0.0.0";

try {
  await app.listen({ port, host });
  app.serviceLogger.info("tomorrow-service started", { port, host });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  app.serviceLogger.error("tomorrow-service failed to start", { error: message });
  process.exit(1);
}
