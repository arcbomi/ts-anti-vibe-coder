import type { FastifyInstance } from "fastify";
import { readBearerToken, sendSuccess, UnauthorizedError, BadRequestError } from "@backend/microservice-sdk";
import type { SyncSucceededProjectReposInput } from "./syncSucceededProjectRepos.input.js";
import type { SyncSucceededProjectReposOutput } from "./syncSucceededProjectRepos.output.js";

type SyncSucceededProjectReposBody = {
  tomorrowUserId: string;
  tomorrowLogin: string;
};

export async function registerSyncSucceededProjectReposRoute(
  app: FastifyInstance,
  deps: {
    syncSucceededProjectRepos: (input: SyncSucceededProjectReposInput) => Promise<SyncSucceededProjectReposOutput>;
    getBearerToken?: typeof readBearerToken;
    sendSuccess?: typeof sendSuccess;
  }
) {
  app.post("/tomorrow/projects/succeeded/sync", async (request, reply) => {
    const accessToken = deps.getBearerToken ? deps.getBearerToken(request.headers.authorization) : readBearerToken(request.headers.authorization);

    if (!accessToken) {
      throw new UnauthorizedError("Missing Tomorrow access token");
    }

    if (request.body === null || typeof request.body !== "object" || Array.isArray(request.body)) {
      throw new BadRequestError("Invalid sync request");
    }

    const body = request.body as Partial<SyncSucceededProjectReposBody>;

    if (typeof body.tomorrowUserId !== "string" || typeof body.tomorrowLogin !== "string") {
      throw new BadRequestError("Invalid sync request");
    }

    const result = await deps.syncSucceededProjectRepos({
      accessToken,
      tomorrowUserId: body.tomorrowUserId,
      tomorrowLogin: body.tomorrowLogin
    });

    if (deps.sendSuccess) {
      return deps.sendSuccess(reply, result);
    }

    return reply.send(result);
  });
}
