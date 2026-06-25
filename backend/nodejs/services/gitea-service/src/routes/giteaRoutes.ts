import type { FastifyInstance, FastifyRequest } from "fastify";
import type { GiteaController } from "../controllers/giteaController.js";
import type { AuthenticatedRequest } from "../types/service.js";

export function registerGiteaRoutes(
  app: FastifyInstance,
  input: {
    controller: GiteaController;
    requireAuth: (request: AuthenticatedRequest) => Promise<void>;
  }
) {
  const preHandler = input.requireAuth;

  app.get("/healthz", async (_request, reply) => reply.code(200).send("ok"));
  app.get("/repositories", { preHandler }, async (request, reply) =>
    input.controller.listRepositories(request as FastifyRequest & AuthenticatedRequest, reply)
  );
  app.post("/repositories/sync-tomorrow", { preHandler }, async (request, reply) =>
    input.controller.syncTomorrowProjects(request as FastifyRequest & AuthenticatedRequest, reply)
  );
  app.post("/repositories", { preHandler }, async (request, reply) =>
    input.controller.createRepository(request as FastifyRequest<{ Body: { gitea_repo_url?: string } }> & AuthenticatedRequest, reply)
  );
  app.post("/repositories/:id/check-bot-access", { preHandler }, async (request, reply) =>
    input.controller.checkBotAccess(request as FastifyRequest<{ Params: { id: string } }> & AuthenticatedRequest, reply)
  );
  app.post("/repositories/:id/start-analysis", { preHandler }, async (request, reply) =>
    input.controller.startAnalysis(request as FastifyRequest<{ Params: { id: string } }> & AuthenticatedRequest, reply)
  );
  app.get("/repositories/:id", { preHandler }, async (request, reply) =>
    input.controller.getRepository(request as FastifyRequest<{ Params: { id: string } }> & AuthenticatedRequest, reply)
  );
  app.get("/analysis-jobs/:id", { preHandler }, async (request, reply) =>
    input.controller.getAnalysisJob(request as FastifyRequest<{ Params: { id: string } }> & AuthenticatedRequest, reply)
  );
}
