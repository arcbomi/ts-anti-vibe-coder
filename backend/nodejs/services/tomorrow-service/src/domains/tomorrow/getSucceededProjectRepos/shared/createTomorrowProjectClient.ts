import { AppError } from "@backend/microservice-sdk";
import type { TomorrowProjectClient } from "./TomorrowProjectClient.js";
import { tomorrowGraphqlProjectRequest } from "./tomorrowGraphqlProjectRequest.js";
import { mapSucceededProject } from "./tomorrowProjectMapper.js";

type GraphQlResponse = {
  data?: {
    progress?: Array<{
      path?: string;
      object?: {
        name?: string;
        type?: string;
      } | null;
    }>;
  };
  errors?: Array<{ message?: string }>;
} | null;

export function createTomorrowProjectClient(config: {
  graphQlEndpoint: string;
  graphQlRole: string;
  timeoutMs: number;
}): TomorrowProjectClient {
  return {
    async listSucceededProjects(input) {
      const userId = Number(input.tomorrowUserId);
      if (!Number.isInteger(userId) || userId <= 0) {
        throw new AppError("Tomorrow user id must be numeric.", {
          statusCode: 400,
          code: "BAD_REQUEST"
        });
      }

      const response = await fetch(config.graphQlEndpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.accessToken}`,
          "X-Hasura-Role": config.graphQlRole
        },
        body: JSON.stringify(tomorrowGraphqlProjectRequest(userId)),
        signal: AbortSignal.timeout(config.timeoutMs)
      });

      const payload = (await response.json().catch(() => null)) as GraphQlResponse;

      if (response.status === 401 || response.status === 403) {
        throw new AppError("Invalid Tomorrow access token.", {
          statusCode: 401,
          code: "UNAUTHORIZED"
        });
      }

      if (!response.ok || payload?.errors?.length) {
        throw new AppError("Tomorrow project discovery failed.", {
          statusCode: 502,
          code: "TOMORROW_PROJECT_LOOKUP_FAILED"
        });
      }

      const seen = new Set<string>();
      const projects = [];

      for (const progress of payload?.data?.progress ?? []) {
        const project = mapSucceededProject(progress);
        if (!project || seen.has(project.slug)) {
          continue;
        }

        seen.add(project.slug);
        projects.push(project);
      }

      return projects;
    }
  };
}
