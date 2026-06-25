import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../../../packages/microservice-sdk/src/index.js";
import type { CreateExamRequest, PrepareSucceededProjectRequest, SubmitExamRequest } from "../models/exam.js";
import { ExamService } from "../services/examService.js";

export class ExamController {
  examService: ExamService;

  constructor(examService: ExamService) {
    this.examService = examService;
  }

  async createExam(
    request: FastifyRequest<{ Body: CreateExamRequest }> & { userContext: { userId: string } },
    reply: FastifyReply
  ) {
    return sendSuccess(reply, this.examService.createExam(request.userContext.userId, request.body), 201);
  }

  async getExam(
    request: FastifyRequest<{ Params: { id: string } }> & { userContext: { userId: string } },
    reply: FastifyReply
  ) {
    return sendSuccess(reply, this.examService.getExam(request.userContext.userId, request.params.id));
  }

  async submitExam(
    request: FastifyRequest<{ Params: { id: string }; Body: SubmitExamRequest }> & { userContext: { userId: string } },
    reply: FastifyReply
  ) {
    return sendSuccess(
      reply,
      this.examService.submitExam(request.userContext.userId, request.params.id, request.body)
    );
  }

  async getResult(
    request: FastifyRequest<{ Params: { id: string } }> & { userContext: { userId: string } },
    reply: FastifyReply
  ) {
    return sendSuccess(reply, this.examService.getResult(request.userContext.userId, request.params.id));
  }

  async listSucceededProjects(
    request: FastifyRequest & { userContext: { userId: string } },
    reply: FastifyReply
  ) {
    return sendSuccess(reply, this.examService.listSucceededProjects(request.userContext.userId));
  }

  async startSucceededProjectPreparation(
    request: FastifyRequest<{ Params: { slug: string } }> & { userContext: { userId: string } },
    reply: FastifyReply
  ) {
    return sendSuccess(
      reply,
      this.examService.startSucceededProjectPreparation(request.userContext.userId, request.params.slug)
    );
  }

  async prepareSucceededProject(
    request: FastifyRequest<{ Body: PrepareSucceededProjectRequest }>,
    reply: FastifyReply
  ) {
    return sendSuccess(reply, this.examService.prepareSucceededProject(request.body));
  }
}
