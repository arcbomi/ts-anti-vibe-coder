import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type { JwtClaims, PublicUser } from "../types/auth.js";

type JwtManagerOptions = {
  secret: string;
  ttlMinutes: number;
  now?: () => Date;
};

type TokenHeader = {
  alg: "HS256";
  typ: "JWT";
};

export class JwtManager {
  secret: string;
  ttlMinutes: number;
  now: () => Date;

  constructor({ secret, ttlMinutes, now = () => new Date() }: JwtManagerOptions) {
    if (!secret.trim()) {
      throw new AppError("JWT secret is required", {
        statusCode: 500,
        code: "CONFIGURATION_ERROR"
      });
    }

    this.secret = secret;
    this.ttlMinutes = ttlMinutes > 0 ? ttlMinutes : 60;
    this.now = now;
  }

  generate(user: PublicUser) {
    const now = Math.floor(this.now().getTime() / 1000);
    const claims: JwtClaims = {
      sub: user.id,
      email: user.email,
      name: user.name,
      first_name: user.first_name,
      last_name: user.last_name,
      iat: now,
      exp: now + this.ttlMinutes * 60
    };

    return this.sign(claims);
  }

  validate(token: string) {
    const parts = token.trim().split(".");
    if (parts.length !== 3) {
      throw unauthorizedError();
    }

    const [headerSegment, payloadSegment, signatureSegment] = parts;
    const signature = base64UrlDecode(signatureSegment);
    const expected = sign(`${headerSegment}.${payloadSegment}`, this.secret);
    if (!signature || signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
      throw unauthorizedError();
    }

    const header = decodeJson<TokenHeader>(headerSegment);
    if (!header || header.alg !== "HS256" || header.typ !== "JWT") {
      throw unauthorizedError();
    }

    const claims = decodeJson<JwtClaims>(payloadSegment);
    if (!claims?.sub || !claims.exp) {
      throw unauthorizedError();
    }
    if (Math.floor(this.now().getTime() / 1000) >= claims.exp) {
      throw new AppError("Token has expired.", {
        statusCode: 401,
        code: "TOKEN_EXPIRED"
      });
    }

    return claims;
  }

  private sign(claims: JwtClaims) {
    const headerSegment = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" } satisfies TokenHeader));
    const payloadSegment = base64UrlEncode(JSON.stringify(claims));
    const signed = `${headerSegment}.${payloadSegment}`;
    const signature = base64UrlEncode(sign(signed, this.secret));
    return `${signed}.${signature}`;
  }
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest();
}

function unauthorizedError() {
  return new AppError("Authentication is required.", {
    statusCode: 401,
    code: "UNAUTHORIZED"
  });
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
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
