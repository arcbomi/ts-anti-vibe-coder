import type { FastifyInstance } from "fastify";
import type { HealthControllerPort } from "../types.ts";

interface RegisterTemplateRoutesOptions {
  healthController: HealthControllerPort;
}

export function registerTemplateRoutes(
  app: FastifyInstance,
  { healthController }: RegisterTemplateRoutesOptions
): void {
  app.get("/api/v1/status", async (request, reply) => healthController.status(request, reply));
}
