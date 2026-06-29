import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { sendSuccess } from "@backend/microservice-sdk";
import { registerLoginUserRoute } from "./loginUser.route.js";

test("login route accepts credential payloads", async () => {
  const calls: Array<{ login: string; password: string }> = [];
  const app = Fastify();

  registerLoginUserRoute(app, {
    sendSuccess,
    async loginUser(input) {
      calls.push(input);
      return {
        accessToken: "token:user-1",
        user: {
          id: "user-1",
          login: input.login,
          email: "student@example.com",
          name: "Student User"
        }
      };
    }
  });

  await app.ready();

  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      credential: "student@example.com",
      password: "correct-password"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [
    {
      login: "student@example.com",
      password: "correct-password"
    }
  ]);

  await app.close();
});
