import type { FastifyInstance } from "fastify";

export interface ServiceConfig {
  serviceName: string;
  port: number;
  internalServiceToken: string;
  repository: {
    driver: "memory" | "database";
    databaseUrl: string;
  };
}

export interface ServiceStatus {
  service: string;
  domain: string;
  version: string;
  ready: boolean;
  checkedAt: string;
}

export interface UserServiceApp extends FastifyInstance {
  config: ServiceConfig;
  serviceName: string;
  serviceLogger: {
    info(message: string, metadata?: unknown): void;
    warn(message: string, metadata?: unknown): void;
    error(message: string, metadata?: unknown): void;
  };
}

export type UserServiceConfig = ServiceConfig;
