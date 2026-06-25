import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import { ERROR_CODE } from "../models/gitea.js";

export function validateCreateRepositoryInput(body: { gitea_repo_url?: string } | null | undefined) {
  const giteaRepoUrl = typeof body?.gitea_repo_url === "string" ? body.gitea_repo_url.trim() : "";
  if (!giteaRepoUrl) {
    throw new AppError("The repository URL is invalid.", {
      statusCode: 400,
      code: ERROR_CODE.invalidRepositoryUrl
    });
  }

  return {
    giteaRepoUrl
  };
}
