import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { buildApp } from "./app.js";

const TEST_SECRET = "gateway-test-secret";
const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

test("gateway preserves public and protected proxy behavior", async () => {
  const seenRequests: Array<{ method: string; url: string; userId: string | null; authenticated: string | null }> = [];
  const app = await buildApp({
    env: testEnv(),
    fetchImpl: async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const headers = new Headers(init?.headers);

      seenRequests.push({
        method: init?.method ?? "GET",
        url,
        userId: headers.get("x-user-id"),
        authenticated: headers.get("x-authenticated")
      });

      if (url.endsWith("/auth/login")) {
        return new Response("auth ok", { status: 200 });
      }
      if (url.endsWith("/analysis-jobs/123/questions")) {
        return new Response("question ok", {
          status: 200,
          headers: {
            "content-type": "text/plain",
            "access-control-allow-origin": "http://upstream.example"
          }
        });
      }
      if (url.endsWith("/repositories")) {
        return new Response("gitea ok", { status: 200 });
      }

      return new Response("exam ok", { status: 200 });
    }
  });

  const authResponse = await app.inject({
    method: "POST",
    url: "/auth/login"
  });
  assert.equal(authResponse.statusCode, 200);
  assert.equal(authResponse.body, "auth ok");

  const token = issueToken();

  const repositoryResponse = await app.inject({
    method: "POST",
    url: "/repositories",
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  assert.equal(repositoryResponse.statusCode, 200);
  assert.equal(repositoryResponse.body, "gitea ok");

  const questionResponse = await app.inject({
    method: "GET",
    url: "/analysis-jobs/123/questions",
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  assert.equal(questionResponse.statusCode, 200);
  assert.equal(questionResponse.body, "question ok");
  assert.equal(questionResponse.headers["access-control-allow-origin"], "*");

  assert.deepEqual(seenRequests, [
    {
      method: "POST",
      url: "http://auth-service.test/auth/login",
      userId: null,
      authenticated: null
    },
    {
      method: "POST",
      url: "http://gitea-service.test/repositories",
      userId: TEST_USER_ID,
      authenticated: "true"
    },
    {
      method: "GET",
      url: "http://exam-service.test/api/v1/analysis-jobs/123/questions",
      userId: TEST_USER_ID,
      authenticated: "true"
    }
  ]);

  await app.close();
});

test("gateway rejects protected routes without a bearer token", async () => {
  const app = await buildApp({
    env: testEnv(),
    fetchImpl: async () => new Response("ok", { status: 200 })
  });

  const response = await app.inject({
    method: "GET",
    url: "/repositories/123"
  });

  assert.equal(response.statusCode, 401);
  assert.match(response.body, /Bearer token is required/i);
  await app.close();
});

test("gateway rejects expired tokens", async () => {
  const app = await buildApp({
    env: testEnv(),
    now: () => new Date("2026-01-01T02:00:00Z"),
    fetchImpl: async () => new Response("ok", { status: 200 })
  });

  const response = await app.inject({
    method: "GET",
    url: "/repositories/123",
    headers: {
      authorization: `Bearer ${issueToken(new Date("2026-01-01T00:00:00Z"))}`
    }
  });

  assert.equal(response.statusCode, 401);
  assert.match(response.body, /expired/i);
  await app.close();
});

test("gateway returns 404 for unknown routes", async () => {
  const app = await buildApp({
    env: testEnv(),
    fetchImpl: async () => new Response("ok", { status: 200 })
  });

  const response = await app.inject({
    method: "GET",
    url: "/unknown"
  });

  assert.equal(response.statusCode, 404);
  await app.close();
});

function testEnv(): NodeJS.ProcessEnv {
  return {
    API_GATEWAY_PORT: "8080",
    JWT_SECRET: TEST_SECRET,
    KAFKA_BROKERS: "redpanda:9092",
    AUTH_SERVICE_BASE_URL: "http://auth-service.test",
    GITEA_READER_SERVICE_BASE_URL: "http://gitea-service.test",
    QUESTION_SERVICE_BASE_URL: "http://exam-service.test/api/v1",
    EXAM_SERVICE_BASE_URL: "http://exam-service.test/api/v1"
  };
}

function issueToken(now = new Date("2026-07-01T00:00:00Z")) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: TEST_USER_ID,
      email: "student@example.com",
      name: "Student User",
      iat: issuedAt,
      exp: issuedAt + 60 * 60
    })
  );
  const signed = `${header}.${payload}`;
  const signature = createHmac("sha256", TEST_SECRET).update(signed).digest("base64url");
  return `${signed}.${signature}`;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}
