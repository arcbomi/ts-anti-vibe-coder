import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import { QUESTION_COUNT, QUESTION_OPTION_KEYS } from "../models/question.js";
import type { CreateExamRequest, PrepareSucceededProjectRequest, SubmitExamRequest } from "../models/exam.js";
import { isUuid } from "./questionValidation.js";

export function validateCreateExamRequest(userId: string, payload: CreateExamRequest) {
  if (!isUuid(userId)) {
    throw badRequest("user_id must be a valid uuid");
  }

  if (!isUuid(payload.analysis_job_id)) {
    throw badRequest("analysis_job_id must be a valid uuid");
  }

  if (payload.repository_id && !isUuid(payload.repository_id)) {
    throw badRequest("repository_id must be a valid uuid");
  }

  if (payload.scheduled_at && Number.isNaN(Date.parse(payload.scheduled_at))) {
    throw badRequest("scheduled_at must be a valid ISO timestamp");
  }

  return payload;
}

export function validateSubmitExamRequest(payload: SubmitExamRequest) {
  if (!Array.isArray(payload.answers) || payload.answers.length !== QUESTION_COUNT) {
    throw badRequest(`Exactly ${QUESTION_COUNT} answers are required.`);
  }

  const seen = new Set<string>();
  for (const answer of payload.answers) {
    if (!isUuid(answer.question_id)) {
      throw badRequest("question_id must be a valid uuid");
    }

    const selectedOption = answer.selected_option.trim().toUpperCase();
    if (!QUESTION_OPTION_KEYS.includes(selectedOption as never)) {
      throw badRequest("selected_option must be A, B, C, or D.");
    }

    if (seen.has(answer.question_id)) {
      throw badRequest("Duplicate question_id in submission.");
    }

    seen.add(answer.question_id);
  }

  return payload;
}

export function validatePrepareSucceededProjectRequest(payload: PrepareSucceededProjectRequest) {
  if (!isUuid(payload.user_id)) {
    throw badRequest("user_id must be a valid uuid");
  }

  if (!isUuid(payload.attempt_id)) {
    throw badRequest("attempt_id must be a valid uuid");
  }

  if (!payload.project_slug.trim()) {
    throw badRequest("project_slug is required");
  }

  if (!payload.repo_url.trim()) {
    throw badRequest("repo_url is required");
  }

  return payload;
}

function badRequest(message: string) {
  return new AppError(message, {
    statusCode: 400,
    code: "BAD_REQUEST"
  });
}
