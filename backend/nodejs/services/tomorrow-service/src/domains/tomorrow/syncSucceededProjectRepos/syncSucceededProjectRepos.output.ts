import type { TomorrowProjectRepo } from "../model/TomorrowProjectRepo.js";

export type SyncSucceededProjectReposOutput = {
  syncedCount: number;
  repos: TomorrowProjectRepo[];
  unmatchedProjects: {
    projectName: string;
    projectSlug: string;
    reason: string;
  }[];
};
