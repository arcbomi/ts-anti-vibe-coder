import { AppError } from "@backend/microservice-sdk";
import { readTomorrowJwtClaims } from "../../authenticateTomorrowAccount/shared/tomorrowJwtClaims.js";
import type { TomorrowUserClient } from "./TomorrowUserClient.js";
import { tomorrowGraphqlUserRequest } from "./tomorrowGraphqlUserRequest.js";
import { mapTomorrowUser } from "./tomorrowUserMapper.js";

type GraphQlResponse = {
  data?: {
    user?: {
      login?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
    } | null;
  };
  errors?: Array<{ message?: string }>;
} | null;

export function createTomorrowUserClient(config: {
  graphQlEndpoint: string;
  graphQlRole: string;
  timeoutMs: number;
}): TomorrowUserClient {
  return {
    async getCurrentUser(input) {
      const subject = String(readTomorrowJwtClaims(input.accessToken).sub ?? "").trim();
      if (!subject) {
        throw new AppError("Invalid Tomorrow access token.", {
          statusCode: 401,
          code: "UNAUTHORIZED"
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
        body: JSON.stringify(tomorrowGraphqlUserRequest(Number(subject))),
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
        throw new AppError("Tomorrow user information is unavailable.", {
          statusCode: 502,
          code: "TOMORROW_USER_LOOKUP_FAILED"
        });
      }

      const user = payload?.data?.user;
      if (!user?.login) {
        throw new AppError("Tomorrow user information is unavailable.", {
          statusCode: 502,
          code: "TOMORROW_USER_LOOKUP_FAILED"
        });
      }

      return mapTomorrowUser({
        id: subject,
        login: user.login,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      });
    }
  };
}
