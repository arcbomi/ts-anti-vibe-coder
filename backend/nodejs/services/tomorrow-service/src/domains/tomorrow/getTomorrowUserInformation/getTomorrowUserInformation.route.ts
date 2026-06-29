import type { FastifyInstance } from "fastify";
import { readBearerToken, sendSuccess, UnauthorizedError } from "@backend/microservice-sdk";
import type { GetTomorrowUserInformationInput } from "./getTomorrowUserInformation.input.js";
import type { GetTomorrowUserInformationOutput } from "./getTomorrowUserInformation.output.js";

const successResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["success", "data"],
  properties: {
    success: { type: "boolean", enum: [true] },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["user"],
      properties: {
        user: {
          type: "object",
          additionalProperties: false,
          required: ["id", "login"],
          properties: {
            id: { type: "string" },
            login: { type: "string" },
            email: { type: "string" },
            displayName: { type: "string" },
            avatarUrl: { type: "string" },
            campus: { type: "string" },
            profileUrl: { type: "string" }
          }
        }
      }
    }
  }
} as const;

export async function registerGetTomorrowUserInformationRoute(
  app: FastifyInstance,
  deps: {
    getTomorrowUserInformation: (input: GetTomorrowUserInformationInput) => Promise<GetTomorrowUserInformationOutput>;
    getBearerToken?: typeof readBearerToken;
    sendSuccess?: typeof sendSuccess;
  }
) {
  app.get(
    "/tomorrow/me",
    {
      schema: {
        tags: ["Tomorrow"],
        summary: "Read Tomorrow user information",
        description: "Loads the current Tomorrow School user profile from the bearer token.",
        security: [{ BearerAuth: [] }],
        response: {
          200: successResponseSchema
        }
      }
    },
    async (request, reply) => {
      const accessToken = deps.getBearerToken
        ? deps.getBearerToken(request.headers.authorization)
        : readBearerToken(request.headers.authorization);

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
    }
  );
}
