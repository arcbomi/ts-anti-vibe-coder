import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireInternalToken, requireUser } from "../middlewares/authGuards.js";
import type { SaveGeneratedQuestionsRequest } from "../models/question.js";
import type { QuestionController } from "../controllers/questionController.js";
import type { ExamServiceConfig } from "../types/service.js";

export function registerQuestionRoutes(
  app: FastifyInstance,
  {
    questionController,
    config
  }: {
    questionController: QuestionController;
    config: ExamServiceConfig;
  }
) {
  app.post("/api/v1/questions/generated", {
    preHandler: async (request) => requireInternalToken(request, config)
  }, async (request, reply) =>
    questionController.saveGeneratedQuestions(
      request as FastifyRequest<{ Body: SaveGeneratedQuestionsRequest }>,
      reply
    )
  );

  app.get("/api/v1/internal/exams/:examId/answer-key", {
    preHandler: async (request) => requireInternalToken(request, config)
  }, async (request, reply) =>
    questionController.getAnswerKey(
      request as FastifyRequest<{ Params: { examId: string } }>,
      reply
    )
  );

  app.get("/api/v1/analysis-jobs/:analysisJobId/questions", {
    preHandler: requireUser
  }, async (request, reply) =>
    questionController.getQuestionsByAnalysisJob(
      request as FastifyRequest<{ Params: { analysisJobId: string } }> & { userContext: { userId: string } },
      reply
    )
  );

  app.get("/api/v1/exams/:examId/questions", {
    preHandler: requireUser
  }, async (request, reply) =>
    questionController.getExamQuestions(
      request as FastifyRequest<{ Params: { examId: string } }> & { userContext: { userId: string } },
      reply
    )
  );
}
