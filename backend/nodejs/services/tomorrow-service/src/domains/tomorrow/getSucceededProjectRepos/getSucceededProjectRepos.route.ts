import type { FastifyInstance } from "fastify";
import { BadRequestError, UnauthorizedError, readBearerToken, sendSuccess } from "@backend/microservice-sdk";
import type { GetSucceededProjectReposInput } from "./getSucceededProjectRepos.input.js";
import type { GetSucceededProjectReposOutput } from "./getSucceededProjectRepos.output.js";

type GetSucceededProjectReposBody = Pick<GetSucceededProjectReposInput, "tomorrowUserId" | "tomorrowLogin">;

const successResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["success", "data"],
  properties: {
    success: { type: "boolean", enum: [true] },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["repos"],
      properties: {
        repos: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "projectName",
              "projectSlug",
              "tomorrowLogin",
              "expectedGiteaOwner",
              "expectedGiteaRepo",
              "status"
            ],
            properties: {
              projectName: { type: "string" },
              projectSlug: { type: "string" },
              tomorrowLogin: { type: "string" },
              expectedGiteaOwner: { type: "string" },
              expectedGiteaRepo: { type: "string" },
              status: { type: "string", enum: ["succeeded"] }
            }
          }
        }
      }
    }
  }
} as const;

export async function registerGetSucceededProjectReposRoute(
  app: FastifyInstance,
  deps: {
    getSucceededProjectRepos: (input: GetSucceededProjectReposInput) => Promise<GetSucceededProjectReposOutput>;
    getBearerToken?: typeof readBearerToken;
    sendSuccess?: typeof sendSuccess;
  }
) {
  app.post(
    "/tomorrow/projects/succeeded/repos",
    {
      schema: {
        tags: ["Tomorrow"],
        summary: "Read succeeded project repositories",
        description: "Returns succeeded project repository information for the specified Tomorrow user.",
        security: [{ BearerAuth: [] }],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["tomorrowUserId", "tomorrowLogin"],
          properties: {
            tomorrowUserId: { type: "string" },
            tomorrowLogin: { type: "string" }
          }
        },
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

      if (request.body === null || typeof request.body !== "object" || Array.isArray(request.body)) {
        throw new BadRequestError("Invalid succeeded project repo request.");
      }

      const body = request.body as Partial<GetSucceededProjectReposBody>;
      if (typeof body.tomorrowUserId !== "string" || typeof body.tomorrowLogin !== "string") {
        throw new BadRequestError("Invalid succeeded project repo request.");
      }

      const result = await deps.getSucceededProjectRepos({
        accessToken,
        tomorrowUserId: body.tomorrowUserId,
        tomorrowLogin: body.tomorrowLogin
      });

      if (deps.sendSuccess) {
        return deps.sendSuccess(reply, result);
      }

      return reply.send(result);
    }
  );
}
