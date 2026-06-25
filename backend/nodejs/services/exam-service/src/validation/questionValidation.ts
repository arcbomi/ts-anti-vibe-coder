import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import {
  QUESTION_COUNT,
  QUESTION_DIFFICULTIES,
  QUESTION_OPTION_KEYS,
  type GeneratedQuestionInput,
  type SaveGeneratedQuestionsRequest
} from "../models/question.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateSaveGeneratedQuestionsRequest(payload: SaveGeneratedQuestionsRequest) {
  if (!isUuid(payload.analysis_job_id)) {
    throw badRequest("analysis_job_id must be a valid uuid");
  }

  if (payload.user_id && !isUuid(payload.user_id)) {
    throw badRequest("user_id must be a valid uuid");
  }

  if (payload.repository_id && !isUuid(payload.repository_id)) {
    throw badRequest("repository_id must be a valid uuid");
  }

  if (!Array.isArray(payload.questions) || payload.questions.length !== QUESTION_COUNT) {
    throw badRequest(`exactly ${QUESTION_COUNT} questions are required`);
  }

  payload.questions.forEach((question, index) => validateGeneratedQuestion(question, index));

  return payload;
}

export function validateQuestionLookup(userId: string, resourceId: string, resourceName: string) {
  if (!isUuid(userId)) {
    throw badRequest("user id must be a valid uuid");
  }

  if (!isUuid(resourceId)) {
    throw badRequest(`${resourceName} must be a valid uuid`);
  }
}

export function isUuid(value: string) {
  return UUID_PATTERN.test((value ?? "").trim());
}

function validateGeneratedQuestion(question: GeneratedQuestionInput, index: number) {
  if (!question || typeof question !== "object") {
    throw badRequest(`question ${index + 1}: question payload is required`);
  }

  if (!question.question?.trim()) {
    throw badRequest(`question ${index + 1}: question text is required`);
  }
  if (!isMostlyEnglish(question.question)) {
    throw badRequest(`question ${index + 1}: question text must be English-only`);
  }

  for (const optionKey of QUESTION_OPTION_KEYS) {
    const text = question.options?.[optionKey];
    if (!text?.trim()) {
      throw badRequest(`question ${index + 1}: option ${optionKey} text is required`);
    }
    if (!isMostlyEnglish(text)) {
      throw badRequest(`question ${index + 1}: option ${optionKey} must be English-only`);
    }
  }

  if (!QUESTION_OPTION_KEYS.includes(question.correct_option.trim().toUpperCase() as never)) {
    throw badRequest(`question ${index + 1}: correct_option must be A, B, C, or D`);
  }

  if (!question.explanation?.trim()) {
    throw badRequest(`question ${index + 1}: explanation is required`);
  }
  if (!isMostlyEnglish(question.explanation)) {
    throw badRequest(`question ${index + 1}: explanation must be English-only`);
  }

  if (!QUESTION_DIFFICULTIES.includes(question.difficulty.trim().toLowerCase() as never)) {
    throw badRequest(`question ${index + 1}: difficulty must be easy, medium, or hard`);
  }

  if (!question.source_file_path?.trim()) {
    throw badRequest(`question ${index + 1}: source_file_path is required`);
  }
}

function isMostlyEnglish(value: string) {
  const letters = [...value].filter((character) => /\p{L}/u.test(character));
  if (letters.length === 0) {
    return true;
  }

  const nonLatinLetters = letters.filter((character) => !/\p{Script=Latin}/u.test(character));
  return nonLatinLetters.length / letters.length <= 0.3;
}

function badRequest(message: string) {
  return new AppError(message, {
    statusCode: 400,
    code: "BAD_REQUEST"
  });
}
