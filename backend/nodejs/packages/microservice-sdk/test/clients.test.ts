import assert from "node:assert/strict";
import test from "node:test";
import { AppError, UnauthorizedError, createHttpClient, createTomorrowSchoolAuthClient, createUserServiceClient } from "../src/index.js";

test("userService client calls expected endpoints", async () => {
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: string }> = [];
  const fetcher = (async (input, init) => {
    calls.push({
      url: String(input),
      method: String(init?.method ?? "GET"),
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: typeof init?.body === "string" ? init.body : undefined
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          publicUser: {
            id: "user-1",
            email: "student@example.com",
            name: "Student User",
            username: "student"
          }
        }
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  }) as typeof fetch;
  const client = createUserServiceClient({
    userServiceBaseUrl: "http://user-service.local",
    userServiceTimeoutMs: 1000,
    internalServiceToken: "internal-token"
  }, fetcher);
  const result = await client.findOrCreateFromExternalUser({
    provider: "tomorrow_school",
    externalId: "42",
    login: "student",
    email: "student@example.com",
    displayName: "Student User"
  });

  assert.equal(result.id, "user-1");
  assert.equal(calls[0]?.url, "http://user-service.local/internal/users/external");
  assert.equal(calls[0]?.method, "PUT");
  assert.equal(calls[0]?.headers["x-internal-service-token"], "internal-token");
});

test("Tomorrow School auth client maps invalid credentials to UnauthorizedError", async () => {
  const client = createTomorrowSchoolAuthClient(
    {
      tomorrowSchoolAuthEndpoint: "https://tomorrow-school.invalid/signin",
      tomorrowSchoolTimeoutMs: 1000
    },
    async () =>
      new Response(JSON.stringify({ error: "User does not exist or password incorrect" }), {
        status: 401,
        headers: {
          "content-type": "application/json"
        }
      })
  );

  await assert.rejects(
    async () => {
      await client.login({
        login: "student",
        password: "secret"
      });
    },
    (error: unknown) => error instanceof UnauthorizedError
  );
});

test("HTTP client does not leak raw low-level errors", async () => {
  const client = createHttpClient(
    {
      baseUrl: "http://upstream.local"
    },
    async () => {
      throw new Error("socket hang up");
    }
  );

  await assert.rejects(
    async () => {
      await client.get("/status");
    },
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.message, "HTTP request failed.");
      assert.equal(error.code, "UPSTREAM_UNAVAILABLE");
      return true;
    }
  );
});
