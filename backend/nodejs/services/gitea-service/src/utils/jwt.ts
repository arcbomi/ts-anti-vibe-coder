import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import { ERROR_CODE } from "../models/gitea.js";

type JwtClaims = {
  sub?: string;
  exp?: number;
};

export class JwtValidator {
  secret: string;

  constructor(secret: string) {
    this.secret = secret.trim();
  }

  validate(token: string) {
    const [headerSegment, payloadSegment, signatureSegment] = token.trim().split(".");
    if (!headerSegment || !payloadSegment || !signatureSegment) {
      throw unauthorizedError();
    }

    const expected = createHmac("sha256", this.secret).update(`${headerSegment}.${payloadSegment}`).digest();
    let actual: Buffer;
    try {
      actual = Buffer.from(signatureSegment, "base64url");
    } catch {
      throw unauthorizedError();
    }

    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw unauthorizedError();
    }

    let claims: JwtClaims;
    try {
      claims = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")) as JwtClaims;
    } catch {
      throw unauthorizedError();
    }

    if (!claims.sub || !claims.exp) {
      throw unauthorizedError();
    }
    if (Math.floor(Date.now() / 1000) >= claims.exp) {
      throw new AppError("Token has expired.", {
        statusCode: 401,
        code: "TOKEN_EXPIRED"
      });
    }

    return claims;
  }
}

function unauthorizedError() {
  return new AppError("Authentication is required.", {
    statusCode: 401,
    code: ERROR_CODE.unauthorized
  });
}
