import type { FastifyInstance } from "fastify";
import { BadRequestError, sendSuccess } from "@backend/microservice-sdk";
import type { AuthenticateTomorrowAccountInput } from "./authenticateTomorrowAccount.input.js";
import type { AuthenticateTomorrowAccountOutput } from "./authenticateTomorrowAccount.output.js";

const successResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["success", "data"],
  properties: {
    success: { type: "boolean", enum: [true] },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["token"],
      properties: {
        token: {
          type: "object",
          additionalProperties: false,
          required: ["accessToken"],
          properties: {
            accessToken: { type: "string" },
            expiresAt: { type: "string", format: "date-time" },
            tokenType: { type: "string" }
          }
        }
      }
    }
  }
} as const;

export async function registerAuthenticateTomorrowAccountRoute(
  app: FastifyInstance,
  deps: {
    authenticateTomorrowAccount: (input: AuthenticateTomorrowAccountInput) => Promise<AuthenticateTomorrowAccountOutput>;
    sendSuccess?: typeof sendSuccess;
  }
) {
  app.post(
    "/tomorrow/authenticate",
    {
      schema: {
        tags: ["Tomorrow"],
        summary: "Authenticate with Tomorrow School",
        description: "Authenticates against Tomorrow School and returns a Tomorrow access token payload.",
        body: {
          type: "object",
          additionalProperties: false,
          required: ["login", "password"],
          properties: {
            login: { type: "string" },
            password: {
              type: "string"
            }
          }
        },
        response: {
          200: successResponseSchema
        }
      }
    },
    async (request, reply) => {
      if (request.body === null || typeof request.body !== "object" || Array.isArray(request.body)) {
        throw new BadRequestError("Invalid Tomorrow authentication request");
      }

      const body = request.body as Partial<AuthenticateTomorrowAccountInput>;

      if (typeof body.login !== "string" || typeof body.password !== "string") {
        throw new BadRequestError("Invalid Tomorrow authentication request");
      }

      const result = await deps.authenticateTomorrowAccount({
        login: body.login,
        password: body.password
      });

      if (deps.sendSuccess) {
        return deps.sendSuccess(reply, result);
      }

      return reply.send(result);
    }
  );
}
