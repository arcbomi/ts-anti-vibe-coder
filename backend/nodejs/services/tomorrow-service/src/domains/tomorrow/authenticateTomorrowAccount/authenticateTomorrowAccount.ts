import { AppError, UnauthorizedError } from "@backend/microservice-sdk";
import type { AuthenticateTomorrowAccountInput } from "./authenticateTomorrowAccount.input.js";
import type { AuthenticateTomorrowAccountOutput } from "./authenticateTomorrowAccount.output.js";
import { assertTomorrowLoginAllowed } from "./authenticateTomorrowAccount.policy.js";

export function createAuthenticateTomorrowAccount(deps: {
  tomorrowClient: {
    authenticate(input: { login: string; password: string }): Promise<{
      accessToken: string;
      refreshToken?: string;
      expiresAt?: string;
      tokenType?: string;
    }>;
  };
}) {
  return async function authenticateTomorrowAccount(
    input: AuthenticateTomorrowAccountInput
  ): Promise<AuthenticateTomorrowAccountOutput> {
    assertTomorrowLoginAllowed(input);

    try {
      const token = await deps.tomorrowClient.authenticate({
        login: input.login.trim(),
        password: input.password
      });

      return {
        token: {
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          expiresAt: token.expiresAt,
          tokenType: token.tokenType
        }
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new UnauthorizedError("Invalid Tomorrow credentials");
    }
  };
}
