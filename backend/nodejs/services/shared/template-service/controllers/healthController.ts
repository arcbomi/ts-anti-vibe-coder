import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../sdk.ts";
import type { HealthServicePort } from "../types.ts";

export class HealthController {
  healthService: HealthServicePort;

  constructor(healthService: HealthServicePort) {
    this.healthService = healthService;
  }

  async status(_request: FastifyRequest, reply: FastifyReply) {
    return sendSuccess(reply, this.healthService.getStatus());
  }
}
