import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import { ERROR_CODE, type JwtClaims, type UserContext } from "../models/gateway.js";

type JwtValidatorOptions = {
  secret: string;
  now?: () => Date;
};

type TokenHeader = {
  alg: "HS256";
  typ: "JWT";
};

export class HmacJwtValidator {
  private readonly secret: string;
  private readonly now: () => Date;

  constructor({ secret, now = () => new Date() }: JwtValidatorOptions) {
    if (!secret.trim()) {
      throw new AppError("JWT secret is required.", {
        statusCode: 500,
        code: ERROR_CODE.configurationError
      });
    }

    this.secret = secret;
    this.now = now;
  }

  validate(token: string): UserContext {
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
        code: ERROR_CODE.tokenExpired
      });
    }

    return { userId: claims.sub };
  }
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest();
}

function unauthorizedError() {
  return new AppError("Authentication is required.", {
    statusCode: 401,
    code: ERROR_CODE.unauthorized
  });
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
