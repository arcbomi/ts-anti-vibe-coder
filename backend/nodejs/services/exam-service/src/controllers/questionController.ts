import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "@backend/microservice-sdk";
import type { SaveGeneratedQuestionsRequest } from "../models/question.js";
import { QuestionService } from "../services/questionService.js";

export class QuestionController {
  questionService: QuestionService;

  constructor(questionService: QuestionService) {
    this.questionService = questionService;
  }

  async saveGeneratedQuestions(request: FastifyRequest<{ Body: SaveGeneratedQuestionsRequest }>, reply: FastifyReply) {
    return sendSuccess(reply, this.questionService.saveGeneratedQuestions(request.body));
  }

  async getQuestionsByAnalysisJob(
    request: FastifyRequest<{ Params: { analysisJobId: string } }> & { auth: { userId: string } },
    reply: FastifyReply
  ) {
    return sendSuccess(
      reply,
      this.questionService.getQuestionsByAnalysisJob(request.auth.userId, request.params.analysisJobId)
    );
  }

  async getExamQuestions(
    request: FastifyRequest<{ Params: { examId: string } }> & { auth: { userId: string } },
    reply: FastifyReply
  ) {
    return sendSuccess(reply, this.questionService.getExamQuestions(request.auth.userId, request.params.examId));
  }

  async getAnswerKey(request: FastifyRequest<{ Params: { examId: string } }>, reply: FastifyReply) {
    return sendSuccess(reply, this.questionService.getAnswerKey(request.params.examId));
  }
}
