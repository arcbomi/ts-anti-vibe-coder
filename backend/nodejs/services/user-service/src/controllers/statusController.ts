import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../../../packages/microservice-sdk/src/index.js";
import type { StatusService } from "../services/statusService.ts";

export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  async status(_request: FastifyRequest, reply: FastifyReply) {
    return sendSuccess(reply, this.statusService.getStatus());
  }
}
