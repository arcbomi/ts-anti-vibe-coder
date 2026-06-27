import type { FastifyReply } from "fastify";
import { AppError, isAppError } from "../errors/AppError.js";

export type ErrorResponseBody = {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function sendError(reply: FastifyReply, error: unknown) {
  const appError = normalizeAppError(error);

  const payload: ErrorResponseBody = {
    success: false,
    data: null,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details === undefined ? {} : { details: appError.details })
    }
  };

  return reply.code(appError.statusCode).send(payload);
}

export function normalizeAppError(error: unknown) {
  if (isAppError(error)) {
    return error;
  }

  return new AppError("Internal server error.", {
    statusCode: 500,
    code: "INTERNAL_ERROR"
  });
}
