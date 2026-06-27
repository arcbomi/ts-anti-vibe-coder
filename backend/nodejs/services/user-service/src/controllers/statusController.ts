import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "@backend/microservice-sdk";
import type { StatusService } from "../services/statusService.ts";

export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  async status(_request: FastifyRequest, reply: FastifyReply) {
    return sendSuccess(reply, this.statusService.getStatus());
  }
}
