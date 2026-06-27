import { BadRequestError } from "@backend/microservice-sdk";
import type { SyncSucceededProjectReposInput } from "./syncSucceededProjectRepos.input.js";

export function assertSyncSucceededProjectReposAllowed(input: SyncSucceededProjectReposInput) {
  if (!input.accessToken.trim() || !input.tomorrowUserId.trim() || !input.tomorrowLogin.trim()) {
    throw new BadRequestError("Tomorrow token, user id, and login are required");
  }
}
