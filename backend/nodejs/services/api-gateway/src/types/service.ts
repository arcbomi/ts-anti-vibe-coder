import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ProxyRoute, ProxyTargetKey, UserContext } from "../models/gateway.js";

export type ApiGatewayConfig = {
  serviceName: string;
  port: number;
  jwtSecret: string;
  upstreams: Record<ProxyTargetKey, string>;
};

export type ApiGatewayRequest = FastifyRequest & {
  userContext?: UserContext;
};

export type RouteMatchResult = {
  route: ProxyRoute;
  pathParams: Record<string, string>;
};

export type JwtValidator = {
  validate(token: string): UserContext;
};

export type ProxyRequestInput = {
  request: ApiGatewayRequest;
  route: ProxyRoute;
  pathParams: Record<string, string>;
};

export type ProxyRequestResult = {
  statusCode: number;
  headers: Headers;
  body: Buffer;
};

export type UpstreamProxy = {
  forward(input: ProxyRequestInput): Promise<ProxyRequestResult>;
};

export type ApiGatewayApp = FastifyInstance & {
  config: ApiGatewayConfig;
  serviceLogger: {
    info(message: string, metadata?: unknown): void;
    warn(message: string, metadata?: unknown): void;
    error(message: string, metadata?: unknown): void;
  };
};
