import type { FastifyInstance } from "fastify";
import type { WorkerController } from "../controllers/workerController.ts";

interface RegisterWorkerServiceRoutesOptions {
  workerController: WorkerController;
}

export function registerWorkerServiceRoutes(
  app: FastifyInstance,
  { workerController }: RegisterWorkerServiceRoutesOptions
): void {
  app.get("/api/v1/status", async (request, reply) => workerController.status(request, reply));
  app.get("/api/v1/health", async (request, reply) => workerController.status(request, reply));
}
