import { buildExamService } from "./app.js";

const app = buildExamService();
const port = app.config.port;
const host = "0.0.0.0";

try {
  await app.listen({ port, host });
  app.serviceLogger.info("exam-service started", { port, host });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  app.serviceLogger.error("exam-service failed to start", { error: message });
  process.exit(1);
}
