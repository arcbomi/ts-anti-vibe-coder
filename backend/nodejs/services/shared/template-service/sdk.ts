import {
  createFastifyApp as createSdkFastifyApp,
  createLogger as createSdkLogger,
  isAppError as isSdkAppError,
  sendSuccess as sendSdkSuccess
} from "@backend/microservice-sdk";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { ServiceLogger } from "./types.ts";

interface CreateServiceAppOptions {
  serviceName: string;
  logger: ServiceLogger;
  registerRoutes(app: FastifyInstance): void;
  setErrorHandler(app: FastifyInstance): void;
}

interface AppErrorLike extends Error {
  statusCode: number;
  code: string;
}

export function createLogger(serviceName: string): ServiceLogger {
  return createSdkLogger({ serviceName }) as ServiceLogger;
}

export function createServiceApp(options: CreateServiceAppOptions): FastifyInstance {
  return createSdkFastifyApp({
    serviceName: options.serviceName,
    logger: options.logger,
    registerRoutes: options.registerRoutes,
    registerErrorHandler: options.setErrorHandler
  }) as FastifyInstance;
}

export function sendSuccess<T>(reply: FastifyReply, payload: T, statusCode = 200) {
  return sendSdkSuccess(reply, payload, statusCode);
}

export function isAppError(error: unknown): error is AppErrorLike {
  return isSdkAppError(error);
}
