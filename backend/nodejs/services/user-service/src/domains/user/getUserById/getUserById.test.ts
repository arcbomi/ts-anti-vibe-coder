import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundError } from "@backend/microservice-sdk";
import { createGetUserById } from "./getUserById.js";

test("getUserById returns user and publicUser", async () => {
  const getUserById = createGetUserById({
    userStore: {
      async findById() {
        return {
          id: "user-1",
          email: "student@example.com",
          login: "student",
          username: "student",
          displayName: "Student User",
          externalIdentities: [
            {
              provider: "tomorrow",
              externalUserId: "42",
              externalLogin: "student"
            }
          ],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        };
      }
    }
  });

  const result = await getUserById({
    userId: "user-1"
  });

  assert.equal(result.user.id, "user-1");
  assert.equal(result.publicUser.id, "user-1");
});

test("getUserById returns 404 for missing user", async () => {
  const getUserById = createGetUserById({
    userStore: {
      async findById() {
        return null;
      }
    }
  });

  await assert.rejects(() => getUserById({ userId: "missing" }), (error: unknown) => {
    assert.ok(error instanceof NotFoundError);
    return true;
  });
});
