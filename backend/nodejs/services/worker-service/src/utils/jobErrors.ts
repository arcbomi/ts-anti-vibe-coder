import { AppError } from "../../../../packages/microservice-sdk/src/index.js";

export interface JobErrorShape {
  code: string;
  message: string;
  retryable: boolean;
}

export function normalizeJobError(error: unknown): JobErrorShape {
  if (error instanceof AppError) {
    const retryableCodes = new Set(["DATABASE_ERROR", "GITEA_TEMPORARY_ERROR", "AI_TIMEOUT", "QUEUE_ERROR"]);

    return {
      code: error.code,
      message: error.message,
      retryable: retryableCodes.has(error.code)
    };
  }

  if (error instanceof Error) {
    return {
      code: "UNKNOWN_ERROR",
      message: error.message,
      retryable: true
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "Unknown worker failure.",
    retryable: true
  };
}

export function createRetryableError(error: unknown): JobErrorShape {
  const normalized = normalizeJobError(error);
  return { ...normalized, retryable: true };
}
