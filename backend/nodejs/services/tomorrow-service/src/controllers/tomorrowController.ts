import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../../../packages/microservice-sdk/src/index.js";
import { validateDiscoverProjectsInput } from "../validation/tomorrowValidation.js";
import type { DiscoverProjectsInput, TomorrowProject } from "../types/tomorrow.js";

type TomorrowControllerDependencies = {
  discoveryService: {
    discoverSucceededProjects(input: DiscoverProjectsInput): Promise<TomorrowProject[]>;
  };
};

export class TomorrowController {
  discoveryService: TomorrowControllerDependencies["discoveryService"];

  constructor({ discoveryService }: TomorrowControllerDependencies) {
    this.discoveryService = discoveryService;
  }

  async discoverSucceededProjects(request: FastifyRequest<{ Body: DiscoverProjectsInput }>, reply: FastifyReply) {
    const input = validateDiscoverProjectsInput(request.body);
    const projects = await this.discoveryService.discoverSucceededProjects(input);

    return sendSuccess(reply, {
      count: projects.length,
      projects
    });
  }
}
