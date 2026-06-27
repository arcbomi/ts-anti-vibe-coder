import { randomUUID } from "node:crypto";

export type TomorrowProjectRepo = {
  id: string;
  tomorrowUserId: string;
  tomorrowLogin: string;
  projectName: string;
  projectSlug: string;
  status: "succeeded";
  giteaRepoId: string;
  giteaRepoName: string;
  giteaRepoUrl: string;
  syncedAt: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TomorrowProjectRepoStore = {
  ensureSchema(): Promise<void>;
  upsertMany(input: { repos: TomorrowProjectRepo[] }): Promise<TomorrowProjectRepo[]>;
};

type TomorrowProjectRepoRow = {
  id: string;
  tomorrow_user_id: string;
  tomorrow_login: string;
  project_name: string;
  project_slug: string;
  status: "succeeded";
  gitea_repo_id: string;
  gitea_repo_name: string;
  gitea_repo_url: string;
  synced_at: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
};

export function createTomorrowProjectRepoStore(databaseUrl: string): TomorrowProjectRepoStore {
  void databaseUrl;
  const records = new Map<string, TomorrowProjectRepo>();

  return {
    async ensureSchema() {
      return undefined;
    },

    async upsertMany(input) {
      if (input.repos.length === 0) {
        return [];
      }

      const now = new Date().toISOString();
      const rows = input.repos.map((repo) => ({
        ...repo,
        id: repo.id || randomUUID(),
        createdAt: repo.createdAt ?? now,
        updatedAt: now
      }));

      const result: TomorrowProjectRepo[] = [];
      for (const repo of rows) {
        const key = keyFor(repo.tomorrowUserId, repo.projectSlug);
        const existing = records.get(key);
        const stored: TomorrowProjectRepo = {
          ...repo,
          createdAt: existing?.createdAt ?? repo.createdAt,
          updatedAt: repo.updatedAt
        };

        records.set(key, stored);
        result.push(stored);
      }

      return result.map(mapRow);
    }
  };
}

function mapRow(row: TomorrowProjectRepo): TomorrowProjectRepo {
  return {
    ...row,
    syncedAt: toIsoString(row.syncedAt),
    createdAt: row.createdAt ? toIsoString(row.createdAt) : undefined,
    updatedAt: row.updatedAt ? toIsoString(row.updatedAt) : undefined
  };
}

function keyFor(tomorrowUserId: string, projectSlug: string) {
  return `${tomorrowUserId.trim()}::${projectSlug.trim().toLowerCase()}`;
}

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
