import type { FastifyInstance } from "fastify";
import { BadRequestError, requireInternalServiceAuth, sendSuccess } from "@backend/microservice-sdk";
import type { GetUserByIdInput } from "./getUserById.input.js";
import type { GetUserByIdOutput } from "./getUserById.output.js";

const publicUserSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "createdAt", "updatedAt"],
  properties: {
    id: { type: "string" },
    email: { type: "string" },
    login: { type: "string" },
    username: { type: "string" },
    displayName: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" }
  }
} as const;

const userSchema = {
  ...publicUserSchema,
  required: ["id", "externalIdentities", "createdAt", "updatedAt"],
  properties: {
    ...publicUserSchema.properties,
    externalIdentities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["provider", "externalUserId", "externalLogin"],
        properties: {
          provider: { type: "string", enum: ["tomorrow"] },
          externalUserId: { type: "string" },
          externalLogin: { type: "string" }
        }
      }
    }
  }
} as const;

const successResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["success", "data"],
  properties: {
    success: { type: "boolean", enum: [true] },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["user", "publicUser"],
      properties: {
        user: userSchema,
        publicUser: publicUserSchema
      }
    }
  }
} as const;

export async function registerGetUserByIdRoute(
  app: FastifyInstance,
  deps: {
    getUserById: (input: GetUserByIdInput) => Promise<GetUserByIdOutput>;
    internalServiceToken?: string;
    sendSuccess?: typeof sendSuccess;
  }
) {
  app.get(
    "/internal/users/:id",
    {
      schema: {
        tags: ["User", "Internal"],
        summary: "Read user by id",
        description: "Internal backend-only endpoint. Requires internal service token.",
        security: [{ InternalServiceToken: [] }],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: { type: "string" }
          }
        },
        response: {
          200: successResponseSchema
        }
      }
    },
    async (request, reply) => {
      requireInternalServiceAuth(request, {
        internalServiceToken: deps.internalServiceToken
      });

      const params = request.params as { id?: string };
      if (typeof params.id !== "string") {
        throw new BadRequestError("Invalid user id.");
      }

      const result = await deps.getUserById({
        userId: params.id
      });

      if (deps.sendSuccess) {
        return deps.sendSuccess(reply, result);
      }

      return reply.send(result);
    }
  );
}
