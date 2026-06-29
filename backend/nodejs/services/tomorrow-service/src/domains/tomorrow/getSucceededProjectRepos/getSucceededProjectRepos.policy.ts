import { BadRequestError } from "@backend/microservice-sdk";
import type { GetSucceededProjectReposInput } from "./getSucceededProjectRepos.input.js";

export function assertGetSucceededProjectReposAllowed(input: GetSucceededProjectReposInput) {
  if (!String(input.accessToken ?? "").trim()) {
    throw new BadRequestError("Tomorrow access token is required.");
  }

  if (!String(input.tomorrowUserId ?? "").trim()) {
    throw new BadRequestError("tomorrowUserId is required.");
  }

  if (!String(input.tomorrowLogin ?? "").trim()) {
    throw new BadRequestError("tomorrowLogin is required.");
  }
}
