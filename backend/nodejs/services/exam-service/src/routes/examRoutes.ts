import type { FastifyInstance, FastifyRequest } from "fastify";
import type { CreateExamRequest, PrepareSucceededProjectRequest, SubmitExamRequest } from "../models/exam.js";
import { requireInternalToken, requireUser } from "../middlewares/authGuards.js";
import type { ExamController } from "../controllers/examController.js";
import type { ExamServiceConfig } from "../types/service.js";

export function registerExamRoutes(
  app: FastifyInstance,
  {
    examController,
    config
  }: {
    examController: ExamController;
    config: ExamServiceConfig;
  }
) {
  app.post("/api/v1/internal/preparations", {
    preHandler: async (request) => requireInternalToken(request, config)
  }, async (request, reply) =>
    examController.prepareSucceededProject(
      request as FastifyRequest<{ Body: PrepareSucceededProjectRequest }>,
      reply
    )
  );

  app.get("/api/v1/succeeded-projects", {
    preHandler: requireUser
  }, async (request, reply) =>
    examController.listSucceededProjects(request as FastifyRequest & { userContext: { userId: string } }, reply)
  );

  app.post("/api/v1/succeeded-projects/:slug/prepare", {
    preHandler: requireUser
  }, async (request, reply) =>
    examController.startSucceededProjectPreparation(
      request as FastifyRequest<{ Params: { slug: string } }> & { userContext: { userId: string } },
      reply
    )
  );

  app.post("/api/v1/exams", {
    preHandler: requireUser
  }, async (request, reply) =>
    examController.createExam(
      request as FastifyRequest<{ Body: CreateExamRequest }> & { userContext: { userId: string } },
      reply
    )
  );

  app.get("/api/v1/exams/:id", {
    preHandler: requireUser
  }, async (request, reply) =>
    examController.getExam(
      request as FastifyRequest<{ Params: { id: string } }> & { userContext: { userId: string } },
      reply
    )
  );

  app.post("/api/v1/exams/:id/submit", {
    preHandler: requireUser
  }, async (request, reply) =>
    examController.submitExam(
      request as FastifyRequest<{ Params: { id: string }; Body: SubmitExamRequest }> & {
        userContext: { userId: string };
      },
      reply
    )
  );

  app.get("/api/v1/exams/:id/result", {
    preHandler: requireUser
  }, async (request, reply) =>
    examController.getResult(
      request as FastifyRequest<{ Params: { id: string } }> & { userContext: { userId: string } },
      reply
    )
  );
}
