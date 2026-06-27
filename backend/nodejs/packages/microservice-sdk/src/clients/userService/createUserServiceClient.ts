import { randomUUID } from "node:crypto";
import type { AppConfig } from "../../config/AppConfig.js";
import { AppError } from "../../errors/AppError.js";
import { createHttpClient } from "../httpClient/createHttpClient.js";
import type { UserServiceClient } from "./UserServiceClient.js";

type PublicUserResponse = {
  id: string;
  email?: string;
  name?: string;
  username?: string;
};

export function createUserServiceClient(
  config: Pick<AppConfig, "internalServiceToken" | "userServiceBaseUrl" | "userServiceTimeoutMs">,
  fetcher?: typeof fetch
): UserServiceClient {
  if (!config.userServiceBaseUrl) {
    throw new AppError("userServiceBaseUrl is required.", {
      statusCode: 500,
      code: "CONFIGURATION_ERROR"
    });
  }

  const httpClient = createInternalClient(config, fetcher);

  return {
    async findOrCreateFromExternalUser(input) {
      const response = await httpClient.put<{
        publicUser: PublicUserResponse;
      }>("/internal/users/external", {
        id: randomUUID(),
        email: input.email ?? `${input.externalId}@tomorrow-school.local`,
        name: input.displayName ?? input.login,
        username: input.login,
        loginCredential: input.login,
        authProvider: input.provider === "tomorrow_school" ? "tomorrow-school" : "local"
      });

      return toUser(response.publicUser);
    },
    async getCurrentUser(input) {
      const response = await httpClient.get<PublicUserResponse>(`/internal/users/${encodeURIComponent(input.userId)}/public`);
      return toUser(response);
    }
  };
}

export function createInternalClient(
  config: Pick<AppConfig, "internalServiceToken" | "userServiceBaseUrl" | "userServiceTimeoutMs">,
  fetcher?: typeof fetch
) {
  return createHttpClient(
    {
      baseUrl: config.userServiceBaseUrl ?? "",
      timeoutMs: config.userServiceTimeoutMs ?? 5000,
      headers: {
        "x-internal-service-token": config.internalServiceToken ?? "local-internal-token"
      }
    },
    fetcher
  );
}

function toUser(user: PublicUserResponse) {
  return {
    id: user.id,
    login: user.username,
    email: user.email,
    displayName: user.name
  };
}
