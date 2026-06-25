import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type { UserRecordEnvelope, UserWriteRequest } from "../shared/contracts/auth.js";

type ServiceResponse<T> = {
  success: boolean;
  data: T;
  error?: {
    code?: string;
    message?: string;
  };
};

export class UserServiceClient {
  constructor(
    private readonly config: {
      baseUrl: string;
      internalToken: string;
      timeoutMs: number;
    }
  ) {}

  upsertExternalUser(input: UserWriteRequest) {
    return this.request<UserRecordEnvelope>("/internal/users/external", {
      method: "PUT",
      body: JSON.stringify(input)
    });
  }

  private async request<T>(path: string, init: RequestInit = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(new URL(path, this.config.baseUrl).toString(), {
        ...init,
        headers: {
          "content-type": "application/json",
          "x-internal-service-token": this.config.internalToken,
          ...(init.headers ?? {})
        },
        signal: controller.signal
      });

      const payload = (await response.json().catch(() => null)) as ServiceResponse<T> | null;
      if (!response.ok) {
        throw new AppError(payload?.error?.message ?? "User service request failed.", {
          statusCode: response.status,
          code: payload?.error?.code ?? "USER_SERVICE_REQUEST_FAILED"
        });
      }

      return payload?.data as T;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("User service request failed.", {
        statusCode: 502,
        code: "USER_SERVICE_REQUEST_FAILED",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
