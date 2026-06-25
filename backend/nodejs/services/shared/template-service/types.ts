import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export interface ServiceLogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export interface ServiceConfig {
  serviceName: string;
  port: number;
}

export interface ServiceApp extends FastifyInstance {
  config: ServiceConfig;
  serviceName: string;
  serviceLogger: ServiceLogger;
}

export interface ServiceStatus {
  service: string;
  version: string;
  ready: boolean;
  checkedAt: string;
}

export interface HealthRepositoryPort {
  readStatus(): ServiceStatus;
}

export interface HealthServicePort {
  getStatus(): ServiceStatus;
}

export interface HealthControllerPort {
  status(request: FastifyRequest, reply: FastifyReply): Promise<unknown>;
}
