import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestError } from "@backend/microservice-sdk";
import { createGetSucceededProjectRepos } from "./getSucceededProjectRepos.js";

test("getSucceededProjectRepos validates input", async () => {
  const usecase = createGetSucceededProjectRepos({
    tomorrowProjectClient: {
      async listSucceededProjects() {
        return [];
      }
    }
  });

  await assert.rejects(() => usecase({ accessToken: "", tomorrowUserId: "", tomorrowLogin: "" }), (error: unknown) => {
    assert.ok(error instanceof BadRequestError);
    return true;
  });
});

test("getSucceededProjectRepos maps succeeded projects to repo candidates", async () => {
  const calls: Array<{ accessToken: string; tomorrowUserId: string }> = [];
  const usecase = createGetSucceededProjectRepos({
    tomorrowProjectClient: {
      async listSucceededProjects(input) {
        calls.push(input);
        return [
          {
            id: "repo-1",
            name: "Piscine Go",
            slug: "piscine-go",
            status: "succeeded" as const
          }
        ];
      }
    }
  });

  const result = await usecase({
    accessToken: "tomorrow-token",
    tomorrowUserId: "42",
    tomorrowLogin: "student"
  });

  assert.deepEqual(calls, [{ accessToken: "tomorrow-token", tomorrowUserId: "42" }]);
  assert.deepEqual(result, {
    repos: [
      {
        projectName: "Piscine Go",
        projectSlug: "piscine-go",
        tomorrowLogin: "student",
        expectedGiteaOwner: "student",
        expectedGiteaRepo: "piscine-go",
        status: "succeeded"
      }
    ]
  });
});
