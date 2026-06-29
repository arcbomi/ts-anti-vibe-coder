import assert from "node:assert/strict";
import test from "node:test";
import { createReadCurrentUser } from "./readCurrentUser.js";

test("readCurrentUser returns user from user-service client", async () => {
  const readCurrentUser = createReadCurrentUser({
    userService: {
      async saveExternalUser() {
        throw new Error("not used");
      },
      async getUserById({ userId }) {
        return {
          id: userId,
          login: "student",
          email: "student@example.com",
          displayName: "Student User"
        };
      }
    }
  });

  const result = await readCurrentUser({
    userId: "user-1"
  });

  assert.equal(result.user.id, "user-1");
  assert.equal(result.user.displayName, "Student User");
});
