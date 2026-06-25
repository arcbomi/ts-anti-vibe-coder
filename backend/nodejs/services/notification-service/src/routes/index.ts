import type { FastifyInstance } from "fastify";
import type { StatusController } from "../controllers/statusController.ts";

interface RegisterNotificationServiceRoutesOptions {
  statusController: StatusController;
}

export function registerNotificationServiceRoutes(
  app: FastifyInstance,
  { statusController }: RegisterNotificationServiceRoutesOptions
): void {
  app.get("/api/v1/status", async (request, reply) => statusController.status(request, reply));
  app.get("/api/v1/health", async (request, reply) => statusController.status(request, reply));
}
