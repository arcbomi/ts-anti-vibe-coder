import assert from "node:assert/strict";
import test from "node:test";
import { createMockEventBus } from "@backend/microservice-sdk";
import { createLoginUser } from "./loginUser.js";
import { assertLoginInputAllowed } from "./loginUser.policy.js";

test("loginUser validates input", () => {
  assert.throws(() => assertLoginInputAllowed({ login: "", password: "secret" }), /Login and password are required/);
  assert.throws(() => assertLoginInputAllowed({ login: "student", password: "" }), /Login and password are required/);
});

test("loginUser authenticates through tomorrow-service, saves the user, stores tomorrow token, signs token, and publishes login event", async () => {
  const eventBus = createMockEventBus();
  const tomorrowAuthCalls: Array<{ login: string; password: string }> = [];
  const tomorrowUserCalls: Array<{ accessToken: string }> = [];
  const userServiceCalls: Array<Record<string, string | undefined>> = [];
  const storedTokens: Array<Record<string, string | undefined>> = [];
  const issuedUserIds: string[] = [];

  const loginUser = createLoginUser({
    tomorrowService: {
      async authenticateTomorrowAccount(input) {
        tomorrowAuthCalls.push(input);
        return {
          accessToken: "tomorrow-token",
          expiresAt: "2026-01-01T00:00:00.000Z"
        };
      },
      async getTomorrowUserInformation(input) {
        tomorrowUserCalls.push(input);
        return {
          id: "42",
          login: "student",
          email: "student@example.com",
          displayName: "Student User"
        };
      }
    },
    userService: {
      async saveExternalUser(input) {
        userServiceCalls.push(input);
        return {
          id: "user-1",
          login: input.externalLogin,
          username: input.externalLogin,
          email: input.email,
          displayName: input.displayName
        };
      },
      async getUserById() {
        throw new Error("not used");
      }
    },
    tomorrowTokenStore: {
      async save(input) {
        storedTokens.push(input);
      },
      async delete() {
        throw new Error("not used");
      }
    },
    accessTokenIssuer: {
      async issue(input) {
        issuedUserIds.push(input.userId);
        return `token:${input.userId}`;
      }
    },
    eventBus,
    logger: {
      info() {},
      warn() {},
      error() {},
      debug() {}
    }
  });

  const result = await loginUser({
    login: "student",
    password: "secret"
  });

  assert.deepEqual(tomorrowAuthCalls, [{ login: "student", password: "secret" }]);
  assert.deepEqual(tomorrowUserCalls, [{ accessToken: "tomorrow-token" }]);
  assert.deepEqual(userServiceCalls, [
    {
      provider: "tomorrow",
      externalUserId: "42",
      externalLogin: "student",
      email: "student@example.com",
      displayName: "Student User"
    }
  ]);
  assert.deepEqual(storedTokens, [
    {
      userId: "user-1",
      tomorrowUserId: "42",
      tomorrowLogin: "student",
      accessToken: "tomorrow-token",
      expiresAt: "2026-01-01T00:00:00.000Z"
    }
  ]);
  assert.deepEqual(issuedUserIds, ["user-1"]);
  assert.equal(result.accessToken, "token:user-1");
  assert.equal(result.user.id, "user-1");
  assert.equal(eventBus.publishedEvents[0]?.topic, "auth.user.logged_in");
});
