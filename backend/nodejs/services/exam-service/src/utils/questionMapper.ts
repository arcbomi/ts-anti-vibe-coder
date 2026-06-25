import { randomUUID } from "node:crypto";
import type {
  AnswerKeyDto,
  ExamQuestionOptionRecord,
  GeneratedQuestionInput,
  GeneratedQuestionRecord,
  PublicQuestionDto,
  QuestionDifficulty,
  QuestionOptionKey
} from "../models/question.js";

export function toGeneratedQuestionRecord(
  analysisJobId: string,
  input: GeneratedQuestionInput,
  now = new Date().toISOString()
): GeneratedQuestionRecord {
  return {
    id: randomUUID(),
    analysisJobId,
    question: input.question.trim(),
    options: {
      A: input.options.A.trim(),
      B: input.options.B.trim(),
      C: input.options.C.trim(),
      D: input.options.D.trim()
    },
    correctOption: input.correct_option.trim().toUpperCase() as QuestionOptionKey,
    explanation: input.explanation.trim(),
    difficulty: input.difficulty.trim().toLowerCase() as QuestionDifficulty,
    sourceFilePath: input.source_file_path.trim(),
    createdAt: now
  };
}

export function toPublicQuestion(question: GeneratedQuestionRecord, includeSourceFilePath: boolean): PublicQuestionDto {
  return {
    id: question.id,
    question: question.question,
    options: { ...question.options },
    difficulty: question.difficulty,
    ...(includeSourceFilePath ? { source_file_path: question.sourceFilePath } : {})
  };
}

export function toMappedPublicQuestion(
  question: GeneratedQuestionRecord,
  mappings: ExamQuestionOptionRecord[]
): PublicQuestionDto {
  const options: Record<string, string> = {};
  for (const mapping of mappings) {
    options[mapping.displayOption] = mapping.optionText;
  }

  return {
    id: question.id,
    question: question.question,
    options,
    difficulty: question.difficulty
  };
}

export function toAnswerKey(question: GeneratedQuestionRecord, mappings: ExamQuestionOptionRecord[]): AnswerKeyDto {
  const displayMapping =
    mappings.find((mapping) => mapping.originalOption === question.correctOption)?.displayOption ?? question.correctOption;

  return {
    question_id: question.id,
    correct_option: displayMapping,
    explanation: question.explanation
  };
}
