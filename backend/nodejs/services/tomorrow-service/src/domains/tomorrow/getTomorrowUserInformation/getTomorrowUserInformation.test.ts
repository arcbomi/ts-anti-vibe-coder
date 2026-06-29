import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestError } from "@backend/microservice-sdk";
import { createGetTomorrowUserInformation } from "./getTomorrowUserInformation.js";

test("getTomorrowUserInformation validates access token", async () => {
  const usecase = createGetTomorrowUserInformation({
    tomorrowUserClient: {
      async getCurrentUser() {
        throw new Error("not used");
      }
    }
  });

  await assert.rejects(() => usecase({ accessToken: "" }), (error: unknown) => {
    assert.ok(error instanceof BadRequestError);
    return true;
  });
});

test("getTomorrowUserInformation returns current user information", async () => {
  const usecase = createGetTomorrowUserInformation({
    tomorrowUserClient: {
      async getCurrentUser() {
        return {
          id: "42",
          login: "dmukhat",
          email: "dmukhat@example.com",
          displayName: "Daniyar Mukhatov",
          avatarUrl: "https://example.com/avatar.png",
          campus: "Astana",
          profileUrl: "https://tomorrow.example/profile"
        };
      }
    }
  });

  const result = await usecase({
    accessToken: "access-token"
  });

  assert.deepEqual(result, {
    user: {
      id: "42",
      login: "dmukhat",
      email: "dmukhat@example.com",
      displayName: "Daniyar Mukhatov",
      avatarUrl: "https://example.com/avatar.png",
      campus: "Astana",
      profileUrl: "https://tomorrow.example/profile"
    }
  });
});
