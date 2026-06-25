import type { FastifyInstance } from "fastify";

export interface ServiceConfig {
  serviceName: string;
  port: number;
}

export interface ServiceStatus {
  service: string;
  domain: string;
  version: string;
  ready: boolean;
  checkedAt: string;
}

export interface RelationshipServiceApp extends FastifyInstance {
  config: ServiceConfig;
  serviceName: string;
  serviceLogger: {
    info(message: string, metadata?: unknown): void;
    warn(message: string, metadata?: unknown): void;
    error(message: string, metadata?: unknown): void;
  };
}
