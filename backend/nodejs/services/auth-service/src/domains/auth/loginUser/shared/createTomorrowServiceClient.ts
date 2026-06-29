import type { AppConfig } from "@backend/microservice-sdk";
import { AppError, createHttpClient } from "@backend/microservice-sdk";
import type { TomorrowServiceClient } from "./TomorrowServiceClient.js";

export function createTomorrowServiceClient(
  config: Pick<AppConfig, "tomorrowServiceBaseUrl" | "tomorrowServiceTimeoutMs">,
  fetcher?: typeof fetch
): TomorrowServiceClient {
  if (!config.tomorrowServiceBaseUrl) {
    throw new AppError("tomorrowServiceBaseUrl is required.", {
      statusCode: 500,
      code: "CONFIGURATION_ERROR"
    });
  }

  const httpClient = createHttpClient(
    {
      baseUrl: config.tomorrowServiceBaseUrl,
      timeoutMs: config.tomorrowServiceTimeoutMs ?? 5000
    },
    fetcher
  );

  return {
    async authenticateTomorrowAccount(input) {
      const response = await httpClient.post<{ token: { accessToken: string; expiresAt?: string; tokenType?: string } }>(
        "/tomorrow/authenticate",
        input
      );

      return response.token;
    },
    async getTomorrowUserInformation(input) {
      const response = await httpClient.get<{
        user: {
          id: string;
          login: string;
          email?: string;
          displayName?: string;
        };
      }>("/tomorrow/me", {
        headers: {
          Authorization: `Bearer ${input.accessToken}`
        }
      });

      return response.user;
    }
  };
}
