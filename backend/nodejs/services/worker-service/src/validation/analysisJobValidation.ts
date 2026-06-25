import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type { AnalysisJobMessage } from "../types/service.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: string, fieldName: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new AppError(`${fieldName} must be a UUID.`, {
      code: "UNKNOWN_ERROR",
      statusCode: 400
    });
  }
}

export function parseAnalysisJobMessage(payload: string): AnalysisJobMessage {
  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch (error) {
    throw new AppError("Analysis job message must be valid JSON.", {
      code: "QUEUE_ERROR",
      statusCode: 400,
      cause: error
    });
  }

  if (!parsed || typeof parsed !== "object") {
    throw new AppError("Analysis job message must be an object.", {
      code: "QUEUE_ERROR",
      statusCode: 400
    });
  }

  const data = parsed as Record<string, unknown>;
  const jobId = String(data.job_id ?? "").trim();
  const userId = String(data.user_id ?? "").trim();
  const repositoryId = String(data.repository_id ?? "").trim();
  const giteaRepoUrl = String(data.gitea_repo_url ?? "").trim();
  const branch = String(data.branch ?? "main").trim() || "main";
  const attempt = Number(data.attempt ?? 1);

  assertUuid(jobId, "job_id");
  assertUuid(userId, "user_id");
  assertUuid(repositoryId, "repository_id");

  try {
    const parsedUrl = new URL(giteaRepoUrl);
    if (!parsedUrl.protocol || !parsedUrl.host || parsedUrl.pathname === "/") {
      throw new Error("invalid");
    }
  } catch (error) {
    throw new AppError("gitea_repo_url must be an absolute Gitea repository URL.", {
      code: "INVALID_REPOSITORY_URL",
      statusCode: 400,
      cause: error
    });
  }

  return {
    jobId,
    userId,
    repositoryId,
    giteaRepoUrl,
    branch,
    attempt: Number.isInteger(attempt) && attempt > 0 ? attempt : 1
  };
}
