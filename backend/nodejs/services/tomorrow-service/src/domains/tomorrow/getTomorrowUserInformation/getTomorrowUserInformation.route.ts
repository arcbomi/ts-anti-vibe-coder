import type { FastifyInstance } from "fastify";
import { readBearerToken, sendSuccess, UnauthorizedError } from "@backend/microservice-sdk";
import type { GetTomorrowUserInformationInput } from "./getTomorrowUserInformation.input.js";
import type { GetTomorrowUserInformationOutput } from "./getTomorrowUserInformation.output.js";

export async function registerGetTomorrowUserInformationRoute(
  app: FastifyInstance,
  deps: {
    getTomorrowUserInformation: (input: GetTomorrowUserInformationInput) => Promise<GetTomorrowUserInformationOutput>;
    getBearerToken?: typeof readBearerToken;
    sendSuccess?: typeof sendSuccess;
  }
) {
  app.get("/tomorrow/me", async (request, reply) => {
    const accessToken = deps.getBearerToken ? deps.getBearerToken(request.headers.authorization) : readBearerToken(request.headers.authorization);

    if (!accessToken) {
      throw new UnauthorizedError("Missing Tomorrow access token");
    }

    const result = await deps.getTomorrowUserInformation({
      accessToken
    });

    if (deps.sendSuccess) {
      return deps.sendSuccess(reply, result);
    }

    return reply.send(result);
  });
}
