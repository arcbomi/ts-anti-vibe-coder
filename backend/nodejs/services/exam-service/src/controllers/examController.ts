import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "@backend/microservice-sdk";
import type { CreateExamRequest, PrepareSucceededProjectRequest, SubmitExamRequest } from "../models/exam.js";
import { ExamService } from "../services/examService.js";

export class ExamController {
  examService: ExamService;

  constructor(examService: ExamService) {
    this.examService = examService;
  }

  async createExam(
    request: FastifyRequest<{ Body: CreateExamRequest }> & { auth: { userId: string } },
    reply: FastifyReply
  ) {
    return sendSuccess(reply, this.examService.createExam(request.auth.userId, request.body), 201);
  }

  async getExam(
    request: FastifyRequest<{ Params: { id: string } }> & { auth: { userId: string } },
    reply: FastifyReply
  ) {
    return sendSuccess(reply, this.examService.getExam(request.auth.userId, request.params.id));
  }

  async submitExam(
    request: FastifyRequest<{ Params: { id: string }; Body: SubmitExamRequest }> & { auth: { userId: string } },
    reply: FastifyReply
  ) {
    return sendSuccess(
      reply,
      this.examService.submitExam(request.auth.userId, request.params.id, request.body)
    );
  }

  async getResult(
    request: FastifyRequest<{ Params: { id: string } }> & { auth: { userId: string } },
    reply: FastifyReply
  ) {
    return sendSuccess(reply, this.examService.getResult(request.auth.userId, request.params.id));
  }

  async listSucceededProjects(
    request: FastifyRequest & { auth: { userId: string } },
    reply: FastifyReply
  ) {
    return sendSuccess(reply, this.examService.listSucceededProjects(request.auth.userId));
  }

  async startSucceededProjectPreparation(
    request: FastifyRequest<{ Params: { slug: string } }> & { auth: { userId: string } },
    reply: FastifyReply
  ) {
    return sendSuccess(
      reply,
      this.examService.startSucceededProjectPreparation(request.auth.userId, request.params.slug)
    );
  }

  async prepareSucceededProject(
    request: FastifyRequest<{ Body: PrepareSucceededProjectRequest }>,
    reply: FastifyReply
  ) {
    return sendSuccess(reply, this.examService.prepareSucceededProject(request.body));
  }
}
