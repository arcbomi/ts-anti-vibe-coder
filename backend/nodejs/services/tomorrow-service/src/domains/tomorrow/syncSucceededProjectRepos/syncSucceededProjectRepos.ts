import { randomUUID } from "node:crypto";
import { AppError } from "@backend/microservice-sdk";
import type { GiteaRepo } from "../model/GiteaRepo.js";
import type { TomorrowProject } from "../model/TomorrowProject.js";
import type { TomorrowProjectRepo, TomorrowProjectRepoStore } from "../model/TomorrowProjectRepo.js";
import type { SyncSucceededProjectReposInput } from "./syncSucceededProjectRepos.input.js";
import type { SyncSucceededProjectReposOutput } from "./syncSucceededProjectRepos.output.js";
import { assertSyncSucceededProjectReposAllowed } from "./syncSucceededProjectRepos.policy.js";

type TomorrowClient = {
  listProjects(input: { accessToken: string; tomorrowUserId: string }): Promise<TomorrowProject[]>;
};

type GiteaClient = {
  listUserRepos(input: { username: string; accessToken?: string }): Promise<GiteaRepo[]>;
};

export function createSyncSucceededProjectRepos(deps: {
  tomorrowClient: TomorrowClient;
  giteaClient: GiteaClient;
  tomorrowProjectRepoStore: TomorrowProjectRepoStore;
  eventBus?: {
    publish(event: {
      topic: string;
      key: string;
      value: unknown;
    }): Promise<void>;
  };
}) {
  return async function syncSucceededProjectRepos(
    input: SyncSucceededProjectReposInput
  ): Promise<SyncSucceededProjectReposOutput> {
    assertSyncSucceededProjectReposAllowed(input);

    let projects: TomorrowProject[];
    try {
      projects = await deps.tomorrowClient.listProjects({
        accessToken: input.accessToken,
        tomorrowUserId: input.tomorrowUserId
      });
    } catch (error) {
      throw error instanceof AppError
        ? error
        : new AppError("Unable to read Tomorrow projects.", {
            statusCode: 502,
            code: "TOMORROW_SYNC_FAILED",
            cause: error
          });
    }

    let repos: GiteaRepo[];
    try {
      repos = await deps.giteaClient.listUserRepos({
        username: input.tomorrowLogin
      });
    } catch (error) {
      throw error instanceof AppError
        ? error
        : new AppError("Unable to read Gitea repositories.", {
            statusCode: 502,
            code: "GITEA_API_ERROR",
            cause: error
          });
    }

    const succeededProjects = projects.filter((project) => normalizeStatus(project.status) === "succeeded");
    const matchedRepos: TomorrowProjectRepo[] = [];
    const unmatchedProjects: SyncSucceededProjectReposOutput["unmatchedProjects"] = [];

    for (const project of succeededProjects) {
      const projectKey = normalizeKey(project.slug || project.name);
      const match = repos.find((repo) => normalizeKey(repo.name) === projectKey);

      if (!match) {
        unmatchedProjects.push({
          projectName: project.name,
          projectSlug: project.slug,
          reason: "No matching Gitea repository found"
        });
        continue;
      }

      matchedRepos.push({
        id: randomUUID(),
        tomorrowUserId: input.tomorrowUserId,
        tomorrowLogin: input.tomorrowLogin,
        projectName: project.name,
        projectSlug: project.slug,
        status: "succeeded",
        giteaRepoId: match.id,
        giteaRepoName: match.name,
        giteaRepoUrl: match.url,
        syncedAt: new Date().toISOString()
      });
    }

    const savedRepos = await deps.tomorrowProjectRepoStore.upsertMany({
      repos: matchedRepos
    });

    if (deps.eventBus) {
      await deps.eventBus.publish({
        topic: "tomorrow.succeeded_project_repos.synced",
        key: input.tomorrowUserId,
        value: {
          version: 1,
          tomorrowUserId: input.tomorrowUserId,
          tomorrowLogin: input.tomorrowLogin,
          syncedCount: savedRepos.length,
          unmatchedCount: unmatchedProjects.length,
          occurredAt: new Date().toISOString()
        }
      });
    }

    return {
      syncedCount: savedRepos.length,
      repos: savedRepos,
      unmatchedProjects
    };
  };
}

function normalizeKey(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeStatus(status: string) {
  return String(status ?? "").trim().toLowerCase();
}
