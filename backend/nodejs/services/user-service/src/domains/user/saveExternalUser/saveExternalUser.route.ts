import type { FastifyInstance } from "fastify";
import { BadRequestError, requireInternalServiceAuth, sendSuccess } from "@backend/microservice-sdk";
import type { SaveExternalUserInput } from "./saveExternalUser.input.js";
import type { SaveExternalUserOutput } from "./saveExternalUser.output.js";

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

export async function registerSaveExternalUserRoute(
  app: FastifyInstance,
  deps: {
    saveExternalUser: (input: SaveExternalUserInput) => Promise<SaveExternalUserOutput>;
    internalServiceToken?: string;
    sendSuccess?: typeof sendSuccess;
  }
) {
  app.put(
    "/internal/users/external",
    {
      schema: {
        tags: ["User", "Internal"],
        summary: "Save external user",
        description: "Internal backend-only endpoint. Requires internal service token.",
        security: [{ InternalServiceToken: [] }],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["provider", "externalUserId", "externalLogin"],
          properties: {
            provider: { type: "string", enum: ["tomorrow"] },
            externalUserId: { type: "string" },
            externalLogin: { type: "string" },
            email: { type: "string" },
            displayName: { type: "string" },
            avatarUrl: { type: "string" }
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

      if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
        throw new BadRequestError("Invalid saveExternalUser request.");
      }

      const body = request.body as Partial<SaveExternalUserInput>;
      if (
        body.provider !== "tomorrow" ||
        typeof body.externalUserId !== "string" ||
        typeof body.externalLogin !== "string"
      ) {
        throw new BadRequestError("Invalid saveExternalUser request.");
      }

      const result = await deps.saveExternalUser({
        provider: body.provider,
        externalUserId: body.externalUserId,
        externalLogin: body.externalLogin,
        email: typeof body.email === "string" ? body.email : undefined,
        displayName: typeof body.displayName === "string" ? body.displayName : undefined,
        avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl : undefined
      });

      if (deps.sendSuccess) {
        return deps.sendSuccess(reply, result);
      }

      return reply.send(result);
    }
  );
}
