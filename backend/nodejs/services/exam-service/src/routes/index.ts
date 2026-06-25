import type { FastifyInstance } from "fastify";
import type { ExamController } from "../controllers/examController.js";
import type { QuestionController } from "../controllers/questionController.js";
import type { ExamServiceConfig } from "../types/service.js";
import { registerExamRoutes } from "./examRoutes.js";
import { registerQuestionRoutes } from "./questionRoutes.js";

export function registerExamServiceRoutes(
  app: FastifyInstance,
  dependencies: {
    config: ExamServiceConfig;
    examController: ExamController;
    questionController: QuestionController;
  }
) {
  registerExamRoutes(app, dependencies);
  registerQuestionRoutes(app, dependencies);
}
