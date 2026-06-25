import {
  createLogger as createSdkLogger,
  createServiceApp as createSdkServiceApp,
  isAppError as isSdkAppError,
  sendSuccess as sendSdkSuccess
} from "../../../packages/microservice-sdk/src/index.js";
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
  return createSdkLogger(serviceName) as ServiceLogger;
}

export function createServiceApp(options: CreateServiceAppOptions): FastifyInstance {
  return createSdkServiceApp(options) as FastifyInstance;
}

export function sendSuccess<T>(reply: FastifyReply, payload: T, statusCode = 200) {
  return sendSdkSuccess(reply, payload, statusCode);
}

export function isAppError(error: unknown): error is AppErrorLike {
  return isSdkAppError(error);
}
