import { createHmac, timingSafeEqual } from "node:crypto";
import type { AppConfig } from "../config/AppConfig.js";
import { AppError } from "../errors/AppError.js";
import { UnauthorizedError } from "../errors/UnauthorizedError.js";
import type { GatewayAuthenticatedUser } from "./GatewayAuthenticatedUser.js";

type AccessTokenClaims = {
  sub: string;
  exp: number;
};

type TokenHeader = {
  alg: "HS256";
  typ: "JWT";
};

type CreateAccessTokenVerifierOptions = {
  now?: () => Date;
};

export type AccessTokenVerifier = {
  verifyAccessToken(token: string): Promise<GatewayAuthenticatedUser>;
};

export function createAccessTokenVerifier(
  config: Pick<AppConfig, "jwtSecret">,
  options: CreateAccessTokenVerifierOptions = {}
): AccessTokenVerifier {
  const now = options.now ?? (() => new Date());
  const secret = config.jwtSecret.trim();

  if (!secret) {
    throw new AppError("JWT secret is required.", {
      statusCode: 500,
      code: "CONFIGURATION_ERROR"
    });
  }

  return {
    async verifyAccessToken(token: string) {
      const claims = verifyToken(token, secret, now);
      return {
        userId: claims.sub
      };
    }
  };
}

function verifyToken(token: string, secret: string, now: () => Date) {
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    throw new UnauthorizedError();
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const signature = base64UrlDecode(signatureSegment);
  const expectedSignature = sign(`${headerSegment}.${payloadSegment}`, secret);

  if (!signature || signature.length !== expectedSignature.length || !timingSafeEqual(signature, expectedSignature)) {
    throw new UnauthorizedError();
  }

  const header = decodeJson<TokenHeader>(headerSegment);
  if (!header || header.alg !== "HS256" || header.typ !== "JWT") {
    throw new UnauthorizedError();
  }

  const claims = decodeJson<AccessTokenClaims>(payloadSegment);
  if (!claims?.sub || !claims.exp) {
    throw new UnauthorizedError();
  }

  if (Math.floor(now().getTime() / 1000) >= claims.exp) {
    throw new UnauthorizedError("Access token has expired.");
  }

  return claims;
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest();
}

function base64UrlDecode(value: string) {
  try {
    return Buffer.from(value, "base64url");
  } catch {
    return null;
  }
}

function decodeJson<T>(segment: string) {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
