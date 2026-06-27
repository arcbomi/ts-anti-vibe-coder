import assert from "node:assert/strict";
import test from "node:test";
import { createMockEventBus } from "@backend/microservice-sdk";
import { createLoginUser } from "./loginUser.js";
import { assertLoginInputAllowed } from "./loginUser.policy.js";

test("loginUser validates input", () => {
  assert.throws(() => assertLoginInputAllowed({ login: "", password: "secret" }), /Login and password are required/);
  assert.throws(() => assertLoginInputAllowed({ login: "student", password: "" }), /Login and password are required/);
});

test("loginUser authenticates, upserts user, signs token, and publishes login event", async () => {
  const eventBus = createMockEventBus();
  const tomorrowSchoolCalls: Array<{ login: string; password: string }> = [];
  const userServiceCalls: Array<Record<string, string | undefined>> = [];
  const issuedUserIds: string[] = [];

  const loginUser = createLoginUser({
    tomorrowSchoolAuth: {
      async login(input) {
        tomorrowSchoolCalls.push(input);
        return {
          externalId: "42",
          login: "student",
          email: "student@example.com",
          displayName: "Student User"
        };
      }
    },
    userService: {
      async findOrCreateFromExternalUser(input) {
        userServiceCalls.push(input);
        return {
          id: "user-1",
          login: input.login,
          email: input.email,
          displayName: input.displayName
        };
      },
      async getCurrentUser() {
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

  assert.deepEqual(tomorrowSchoolCalls, [{ login: "student", password: "secret" }]);
  assert.equal(userServiceCalls.length, 1);
  assert.deepEqual(issuedUserIds, ["user-1"]);
  assert.equal(result.accessToken, "token:user-1");
  assert.equal(result.user.id, "user-1");
  assert.equal(result.user.displayName, "Student User");
  assert.equal(eventBus.publishedEvents[0]?.topic, "auth.user.logged_in");
  assert.equal(eventBus.publishedEvents[0]?.key, "user-1");
});
