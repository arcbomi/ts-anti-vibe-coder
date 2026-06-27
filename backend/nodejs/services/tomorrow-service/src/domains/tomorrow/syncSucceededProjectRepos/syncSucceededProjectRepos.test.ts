import test from "node:test";
import assert from "node:assert/strict";
import { createSyncSucceededProjectRepos } from "./syncSucceededProjectRepos.js";

test("syncSucceededProjectRepos matches only succeeded projects to actual Gitea repos", async () => {
  const published: Array<{ topic: string; key: string; value: unknown }> = [];
  const storeCalls: Array<{ repos: unknown[] }> = [];

  const usecase = createSyncSucceededProjectRepos({
    tomorrowClient: {
      async listProjects() {
        return [
          { id: "1", name: "Go Reloaded", slug: "go-reloaded", status: "succeeded" },
          { id: "2", name: "Skipped", slug: "skipped", status: "failed" },
          { id: "3", name: "No Repo Yet", slug: "no-repo-yet", status: "succeeded" }
        ];
      }
    },
    giteaClient: {
      async listUserRepos() {
        return [
          {
            id: "repo-1",
            name: "go-reloaded",
            owner: "dmukhat",
            url: "https://gitea.example/dmukhat/go-reloaded"
          },
          {
            id: "repo-2",
            name: "other-project",
            owner: "dmukhat",
            url: "https://gitea.example/dmukhat/other-project"
          }
        ];
      }
    },
    tomorrowProjectRepoStore: {
      async ensureSchema() {
        return undefined;
      },
      async upsertMany(input) {
        storeCalls.push(input);
        return input.repos.map((repo) => ({
          ...repo,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }));
      }
    },
    eventBus: {
      async publish(event) {
        published.push(event);
      }
    }
  });

  const result = await usecase({
    accessToken: "access-token",
    tomorrowUserId: "42",
    tomorrowLogin: "dmukhat"
  });

  assert.equal(result.syncedCount, 1);
  assert.equal(result.repos.length, 1);
  assert.equal(result.repos[0]?.giteaRepoUrl, "https://gitea.example/dmukhat/go-reloaded");
  assert.deepEqual(result.unmatchedProjects, [
    {
      projectName: "No Repo Yet",
      projectSlug: "no-repo-yet",
      reason: "No matching Gitea repository found"
    }
  ]);

  assert.equal(storeCalls.length, 1);
  assert.equal(storeCalls[0]?.repos.length, 1);
  assert.equal((storeCalls[0]?.repos[0] as { giteaRepoUrl?: string }).giteaRepoUrl, "https://gitea.example/dmukhat/go-reloaded");

  assert.equal(published.length, 1);
  assert.equal(published[0]?.topic, "tomorrow.succeeded_project_repos.synced");
  assert.equal(published[0]?.key, "42");
  assert.deepEqual(published[0]?.value, {
    version: 1,
    tomorrowUserId: "42",
    tomorrowLogin: "dmukhat",
    syncedCount: 1,
    unmatchedCount: 1,
    occurredAt: (published[0]?.value as { occurredAt?: string } | undefined)?.occurredAt
  });
  assert.ok(JSON.stringify(published[0]).includes("tomorrowLogin"));
  assert.ok(!JSON.stringify(published[0]).includes("secret"));
  assert.ok(!JSON.stringify(published[0]).includes("access-token"));
});
