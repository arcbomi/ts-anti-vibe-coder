import test from "node:test";
import assert from "node:assert/strict";
import { createGetTomorrowUserInformation } from "./getTomorrowUserInformation.js";

test("getTomorrowUserInformation returns current user information", async () => {
  const usecase = createGetTomorrowUserInformation({
    tomorrowClient: {
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
