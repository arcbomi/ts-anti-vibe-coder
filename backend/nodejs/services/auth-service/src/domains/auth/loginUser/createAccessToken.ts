import { createHmac } from "node:crypto";
import type { AppConfig } from "@backend/microservice-sdk";

type AccessTokenClaims = {
  sub: string;
  iat: number;
  exp: number;
};

type TokenHeader = {
  alg: "HS256";
  typ: "JWT";
};

export type AccessTokenIssuer = {
  issue(input: { userId: string }): Promise<string>;
};

type CreateAccessTokenIssuerOptions = {
  now?: () => Date;
};

export function createAccessTokenIssuer(
  config: Pick<AppConfig, "jwtSecret" | "jwtAccessTokenTtl">,
  options: CreateAccessTokenIssuerOptions = {}
): AccessTokenIssuer {
  const now = options.now ?? (() => new Date());
  const secret = config.jwtSecret.trim();
  const ttlSeconds = parseTtlToSeconds(config.jwtAccessTokenTtl ?? "60m");

  return {
    async issue(input) {
      const userId = input.userId.trim();
      const issuedAt = Math.floor(now().getTime() / 1000);
      const claims: AccessTokenClaims = {
        sub: userId,
        iat: issuedAt,
        exp: issuedAt + ttlSeconds
      };

      const header = base64UrlEncode(JSON.stringify({
        alg: "HS256",
        typ: "JWT"
      } satisfies TokenHeader));
      const payload = base64UrlEncode(JSON.stringify(claims));
      const unsignedToken = `${header}.${payload}`;
      const signature = createHmac("sha256", secret).update(unsignedToken).digest("base64url");

      return `${unsignedToken}.${signature}`;
    }
  };
}

function parseTtlToSeconds(rawValue: string) {
  const value = rawValue.trim().toLowerCase();
  const match = value.match(/^(\d+)(s|m|h|d)?$/);
  if (!match) {
    throw new Error(`Invalid JWT ttl: ${rawValue}`);
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? "s";

  switch (unit) {
    case "s":
      return amount;
    case "m":
      return amount * 60;
    case "h":
      return amount * 60 * 60;
    case "d":
      return amount * 60 * 60 * 24;
    default:
      throw new Error(`Invalid JWT ttl unit: ${unit}`);
  }
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}
