import { sendSuccess } from "@backend/microservice-sdk";
import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from "fastify";
import { toHttpCurrentUser } from "../model/CurrentUser.js";
import type { ReadCurrentUserInput } from "./readCurrentUser.input.js";
import type { ReadCurrentUserOutput } from "./readCurrentUser.output.js";

export function registerReadCurrentUserRoute(
  app: FastifyInstance,
  dependencies: {
    readCurrentUser: (input: ReadCurrentUserInput) => Promise<ReadCurrentUserOutput>;
    requireAuth: preHandlerHookHandler;
    getCurrentUserId: (request: FastifyRequest) => string;
    sendSuccess?: typeof sendSuccess;
  }
) {
  app.get(
    "/auth/me",
    {
      preHandler: dependencies.requireAuth
    },
    async (request, reply) => {
      const result = await dependencies.readCurrentUser({
        userId: dependencies.getCurrentUserId(request)
      });
      const payload = toHttpCurrentUser(result.user);

      if (dependencies.sendSuccess) {
        return dependencies.sendSuccess(reply, payload);
      }

      return reply.send(payload);
    }
  );
}
