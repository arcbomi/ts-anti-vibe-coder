import { sendSuccess } from "@backend/microservice-sdk";
import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from "fastify";
import { toHttpCurrentUser } from "../model/CurrentUser.js";
import type { ReadCurrentUserInput } from "./readCurrentUser.input.js";
import type { ReadCurrentUserOutput } from "./readCurrentUser.output.js";

const currentUserSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name"],
  properties: {
    id: { type: "string" },
    login: { type: "string" },
    email: { type: "string" },
    name: { type: "string" },
    full_name: { type: "string" },
    avatar_url: { type: "string" }
  }
} as const;

const successResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["success", "data"],
  properties: {
    success: { type: "boolean", enum: [true] },
    data: currentUserSchema
  }
} as const;

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
      preHandler: dependencies.requireAuth,
      schema: {
        tags: ["Auth"],
        summary: "Read current user",
        description: "Returns the current authenticated user profile.",
        security: [{ BearerAuth: [] }],
        response: {
          200: successResponseSchema
        }
      }
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
