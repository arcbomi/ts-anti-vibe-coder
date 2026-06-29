import type { AppConfig } from "../../config/AppConfig.js";
import { AppError } from "../../errors/AppError.js";
import { createHttpClient } from "../httpClient/createHttpClient.js";
import type { UserServiceClient } from "./UserServiceClient.js";

type UserResponse = {
  id: string;
  email?: string;
  displayName?: string;
  login?: string;
  username?: string;
  avatarUrl?: string;
};

type SaveExternalUserResponse = {
  user: UserResponse;
  publicUser: UserResponse;
};

type GetUserByIdResponse = {
  user: UserResponse;
  publicUser: UserResponse;
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
    async saveExternalUser(input) {
      const response = await httpClient.put<SaveExternalUserResponse>("/internal/users/external", {
        provider: input.provider,
        externalUserId: input.externalUserId,
        externalLogin: input.externalLogin,
        email: input.email,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl
      });

      return toUser(response.user);
    },
    async getUserById(input) {
      const response = await httpClient.get<GetUserByIdResponse>(`/internal/users/${encodeURIComponent(input.userId)}`);
      return toUser(response.user);
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

function toUser(user: UserResponse) {
  return {
    id: user.id,
    login: user.login ?? user.username,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl
  };
}
