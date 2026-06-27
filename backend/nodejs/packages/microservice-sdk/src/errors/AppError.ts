export type AppErrorOptions = {
  statusCode?: number;
  code?: string;
  details?: unknown;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = options.code ?? "INTERNAL_ERROR";
    this.statusCode = options.statusCode ?? 500;
    this.details = options.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
