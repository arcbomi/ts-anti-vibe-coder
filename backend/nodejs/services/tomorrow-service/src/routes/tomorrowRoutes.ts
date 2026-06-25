import type { FastifyInstance, FastifyRequest } from "fastify";
import type { TomorrowController } from "../controllers/tomorrowController.js";
import type { DiscoverProjectsInput } from "../types/tomorrow.js";

export function registerTomorrowRoutes(
  app: FastifyInstance,
  { tomorrowController }: { tomorrowController: TomorrowController }
) {
  app.post("/api/v1/tomorrow/projects/discover", async (request, reply) => {
    return tomorrowController.discoverSucceededProjects(
      request as FastifyRequest<{ Body: DiscoverProjectsInput }>,
      reply
    );
  });
}
