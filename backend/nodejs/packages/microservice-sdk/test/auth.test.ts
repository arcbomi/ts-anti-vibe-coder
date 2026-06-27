import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  attachInternalAuthContext,
  createAccessTokenVerifier,
  readBearerToken,
  requireInternalUserId,
  UnauthorizedError
} from "../src/index.js";

test("readBearerToken reads bearer token value", () => {
  assert.equal(readBearerToken("Bearer token-1"), "token-1");
});

test("access token verifier accepts a valid gateway token", async () => {
  const verifier = createAccessTokenVerifier({
    jwtSecret: "secret"
  });
  const token = issueToken({ userId: "user-1", secret: "secret" });
  const user = await verifier.verifyAccessToken(token);

  assert.equal(user.userId, "user-1");
});

test("access token verifier rejects invalid token", async () => {
  await assert.rejects(
    async () => {
      const verifier = createAccessTokenVerifier({
        jwtSecret: "secret"
      });
      await verifier.verifyAccessToken("invalid");
    },
    (error: unknown) => error instanceof UnauthorizedError
  );
});

test("attachInternalAuthContext populates request auth from trusted gateway headers", async () => {
  const request: {
    headers: Record<string, string>;
    auth?: {
      userId: string;
    };
  } = {
    headers: {
      "x-authenticated": "true",
      "x-user-id": "user-1"
    }
  };

  await attachInternalAuthContext(request as never);

  assert.deepEqual(request.auth, {
    userId: "user-1"
  });
});

test("requireInternalUserId returns authenticated user id", () => {
  const userId = requireInternalUserId({
    auth: {
      userId: "user-1"
    }
  } as never);

  assert.equal(userId, "user-1");
});

test("requireInternalUserId throws if missing", () => {
  assert.throws(() => requireInternalUserId({} as never), UnauthorizedError);
});

function issueToken(input: { userId: string; secret: string }) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: input.userId,
    exp: Math.floor(Date.now() / 1000) + 60
  })).toString("base64url");
  const unsignedToken = `${header}.${payload}`;
  const signature = createHmac("sha256", input.secret).update(unsignedToken).digest("base64url");
  return `${unsignedToken}.${signature}`;
}
