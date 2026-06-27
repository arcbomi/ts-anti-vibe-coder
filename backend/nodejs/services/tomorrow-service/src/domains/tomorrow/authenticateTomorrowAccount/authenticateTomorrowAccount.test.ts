import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestError, UnauthorizedError } from "@backend/microservice-sdk";
import { createAuthenticateTomorrowAccount } from "./authenticateTomorrowAccount.js";

test("authenticateTomorrowAccount validates input", async () => {
  const usecase = createAuthenticateTomorrowAccount({
    tomorrowClient: {
      async authenticate() {
        return {
          accessToken: "token"
        };
      }
    }
  });

  await assert.rejects(() => usecase({ login: "", password: "" }), (error: unknown) => {
    assert.ok(error instanceof BadRequestError);
    return true;
  });
});

test("authenticateTomorrowAccount returns a token without password data", async () => {
  const calls: Array<{ login: string; password: string }> = [];
  const usecase = createAuthenticateTomorrowAccount({
    tomorrowClient: {
      async authenticate(input) {
        calls.push(input);
        return {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          expiresAt: "2026-01-01T00:00:00.000Z",
          tokenType: "Bearer"
        };
      }
    }
  });

  const result = await usecase({
    login: " student ",
    password: "secret-password"
  });

  assert.deepEqual(calls, [{ login: "student", password: "secret-password" }]);
  assert.deepEqual(result, {
    token: {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: "2026-01-01T00:00:00.000Z",
      tokenType: "Bearer"
    }
  });
  assert.equal((result as { password?: string }).password, undefined);
});

test("authenticateTomorrowAccount converts external failures to unauthorized", async () => {
  const usecase = createAuthenticateTomorrowAccount({
    tomorrowClient: {
      async authenticate() {
        throw new Error("external auth failed");
      }
    }
  });

  await assert.rejects(() => usecase({ login: "student", password: "secret" }), (error: unknown) => {
    assert.ok(error instanceof UnauthorizedError);
    return true;
  });
});
