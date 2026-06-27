import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError, isAppError } from "../errors/AppError.js";
import type { Logger } from "../logger/Logger.js";
import { sendError } from "./sendError.js";

export type ErrorHandlerOptions = {
  appEnv?: string;
  logger?: Logger;
};

export function errorHandler(options: ErrorHandlerOptions = {}) {
  return function sdkErrorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
    const logger = options.logger ?? readLogger(request.server);
    const publicError = toPublicError(error, options.appEnv);

    logger?.error("request_failed", {
      path: request.url,
      method: request.method,
      statusCode: publicError.statusCode,
      code: publicError.code,
      message: publicError.message
    });

    return sendError(reply, publicError);
  };
}

export function registerErrorHandler(app: FastifyInstance, options: ErrorHandlerOptions = {}) {
  app.setErrorHandler(errorHandler({
    appEnv: options.appEnv,
    logger: options.logger ?? readLogger(app)
  }));
}

function toPublicError(error: unknown, appEnv = "development") {
  if (isAppError(error)) {
    if (appEnv === "production" || error.details === undefined) {
      return error;
    }

    return new AppError(error.message, {
      statusCode: error.statusCode,
      code: error.code,
      details: error.details
    });
  }

  if (appEnv === "production") {
    return new AppError("Internal server error.", {
      statusCode: 500,
      code: "INTERNAL_ERROR"
    });
  }

  return new AppError(error instanceof Error ? error.message : "Internal server error.", {
    statusCode: 500,
    code: "INTERNAL_ERROR"
  });
}

function readLogger(app: FastifyInstance) {
  const maybeApp = app as FastifyInstance & {
    serviceLogger?: Logger;
  };

  return maybeApp.serviceLogger;
}
