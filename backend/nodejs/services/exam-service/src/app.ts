import type { FastifyInstance } from "fastify";
import { createLogger, createServiceApp } from "../../../packages/microservice-sdk/src/index.js";
import { loadExamServiceConfig } from "./config/env.js";
import { ExamController } from "./controllers/examController.js";
import { QuestionController } from "./controllers/questionController.js";
import { registerErrorHandler } from "./middlewares/errorHandler.js";
import { ExamRepository } from "./repositories/examRepository.js";
import { QuestionRepository } from "./repositories/questionRepository.js";
import { registerExamServiceRoutes } from "./routes/index.js";
import { ExamService } from "./services/examService.js";
import { QuestionService } from "./services/questionService.js";
import { createExamServiceStore, type ExamServiceConfig } from "./types/service.js";

export type ExamServiceApp = FastifyInstance & {
  config: ExamServiceConfig;
  serviceLogger: ReturnType<typeof createLogger>;
};

export function buildExamService(): ExamServiceApp {
  const config = loadExamServiceConfig();
  const logger = createLogger(config.serviceName);
  const store = createExamServiceStore();
  const questionRepository = new QuestionRepository(store);
  const examRepository = new ExamRepository(store);
  const questionService = new QuestionService(questionRepository);
  const examService = new ExamService({
    examRepository,
    questionRepository,
    passingScore: config.passingScore,
    examOpenDay: config.examOpenDay
  });
  const questionController = new QuestionController(questionService);
  const examController = new ExamController(examService);

  const app = createServiceApp({
    serviceName: config.serviceName,
    logger,
    registerRoutes(fastify) {
      registerExamServiceRoutes(fastify, { config, examController, questionController });
    },
    setErrorHandler: registerErrorHandler
  }) as unknown as ExamServiceApp;

  app.decorate("config", config);

  return app;
}
