export type AppErrorOptions = {
  statusCode?: number;
  code?: string;
  details?: unknown;
  cause?: unknown;
};

export class AppError extends Error {
  statusCode: number;
  code: string;
  details: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? "INTERNAL_ERROR";
    this.details = options.details ?? null;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
