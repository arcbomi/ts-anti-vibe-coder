export const ERROR_CODE = {
  unauthorized: "UNAUTHORIZED",
  tokenExpired: "TOKEN_EXPIRED",
  badGateway: "BAD_GATEWAY",
  gatewayTimeout: "GATEWAY_TIMEOUT",
  configurationError: "CONFIGURATION_ERROR"
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export type JwtClaims = {
  sub?: string;
  email?: string;
  name?: string;
  exp?: number;
  iat?: number;
};

export type UserContext = {
  userId: string;
};

export type ProxyRoute = {
  service: "auth" | "gitea" | "question" | "exam";
  upstreamPath?: string;
};

export type ProxyTargetKey = ProxyRoute["service"];
