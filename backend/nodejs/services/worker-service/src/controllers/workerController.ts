import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "@backend/microservice-sdk";
import type { WorkerRuntimeService } from "../services/workerRuntimeService.ts";

export class WorkerController {
  constructor(private readonly workerRuntimeService: WorkerRuntimeService) {}

  async status(_request: FastifyRequest, reply: FastifyReply) {
    return sendSuccess(reply, this.workerRuntimeService.getStatus());
  }
}
