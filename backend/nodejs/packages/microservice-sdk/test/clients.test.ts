import assert from "node:assert/strict";
import test from "node:test";
import { AppError, createHttpClient, createUserServiceClient } from "../src/index.js";

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
          user: {
            id: "user-1",
            email: "student@example.com",
            displayName: "Student User",
            login: "student"
          },
          publicUser: {
            id: "user-1",
            email: "student@example.com",
            displayName: "Student User",
            login: "student"
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
  const result = await client.saveExternalUser({
    provider: "tomorrow",
    externalUserId: "42",
    externalLogin: "student",
    email: "student@example.com",
    displayName: "Student User"
  });

  assert.equal(result.id, "user-1");
  assert.equal(calls[0]?.url, "http://user-service.local/internal/users/external");
  assert.equal(calls[0]?.method, "PUT");
  assert.equal(calls[0]?.headers["x-internal-service-token"], "internal-token");
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
