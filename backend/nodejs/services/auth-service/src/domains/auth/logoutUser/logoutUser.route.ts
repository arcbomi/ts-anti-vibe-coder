import { sendSuccess } from "@backend/microservice-sdk";
import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from "fastify";
import type { LogoutUserInput } from "./logoutUser.input.js";
import type { LogoutUserOutput } from "./logoutUser.output.js";

export function registerLogoutUserRoute(
  app: FastifyInstance,
  dependencies: {
    logoutUser: (input: LogoutUserInput) => Promise<LogoutUserOutput>;
    requireAuth: preHandlerHookHandler;
    getCurrentUserId: (request: FastifyRequest) => string;
    sendSuccess?: typeof sendSuccess;
  }
) {
  app.post(
    "/auth/logout",
    {
      preHandler: dependencies.requireAuth
    },
    async (request, reply) => {
      const result = await dependencies.logoutUser({
        userId: dependencies.getCurrentUserId(request)
      });

      if (dependencies.sendSuccess) {
        return dependencies.sendSuccess(reply, result);
      }

      return reply.send(result);
    }
  );
}
