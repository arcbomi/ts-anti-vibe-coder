import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestError } from "@backend/microservice-sdk";
import { createSaveExternalUser } from "./saveExternalUser.js";

test("saveExternalUser validates provider and external identity", async () => {
  const saveExternalUser = createSaveExternalUser({
    userStore: {
      async saveExternalUser() {
        throw new Error("not used");
      }
    }
  });

  await assert.rejects(
    () => saveExternalUser({ provider: "tomorrow", externalUserId: "", externalLogin: "" }),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestError);
      return true;
    }
  );
});

test("saveExternalUser creates user and returns user plus publicUser", async () => {
  let savedInput: Record<string, string | undefined> | null = null;
  const saveExternalUser = createSaveExternalUser({
    userStore: {
      async saveExternalUser(input) {
        savedInput = input;
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

  const result = await saveExternalUser({
    provider: "tomorrow",
    externalUserId: "42",
    externalLogin: "student",
    email: "student@example.com",
    displayName: "Student User",
    avatarUrl: "https://example.com/avatar.png"
  });

  assert.deepEqual(savedInput, {
    provider: "tomorrow",
    externalUserId: "42",
    externalLogin: "student",
    email: "student@example.com",
    displayName: "Student User",
    avatarUrl: "https://example.com/avatar.png"
  });
  assert.equal((result.user as { accessToken?: string }).accessToken, undefined);
  assert.deepEqual(result.publicUser, {
    id: "user-1",
    email: "student@example.com",
    login: "student",
    username: "student",
    displayName: "Student User",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  });
});

test("saveExternalUser updates safe profile fields when the external identity already exists", async () => {
  const saveExternalUser = createSaveExternalUser({
    userStore: {
      async saveExternalUser(input) {
        return {
          id: "user-1",
          email: input.email,
          login: input.externalLogin,
          username: input.externalLogin,
          displayName: input.displayName,
          externalIdentities: [
            {
              provider: "tomorrow",
              externalUserId: input.externalUserId,
              externalLogin: input.externalLogin
            }
          ],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z"
        };
      }
    }
  });

  const result = await saveExternalUser({
    provider: "tomorrow",
    externalUserId: "42",
    externalLogin: "student-renamed",
    email: "renamed@example.com",
    displayName: "Renamed Student"
  });

  assert.equal(result.user.login, "student-renamed");
  assert.equal(result.user.displayName, "Renamed Student");
  assert.equal(result.user.email, "renamed@example.com");
});
