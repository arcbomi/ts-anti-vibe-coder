import type { FastifyInstance } from "fastify";
import type { StatusController } from "../controllers/statusController.ts";

interface RegisterRelationshipServiceRoutesOptions {
  statusController: StatusController;
}

export function registerRelationshipServiceRoutes(
  app: FastifyInstance,
  { statusController }: RegisterRelationshipServiceRoutesOptions
): void {
  app.get("/api/v1/status", async (request, reply) => statusController.status(request, reply));
  app.get("/api/v1/health", async (request, reply) => statusController.status(request, reply));
}
