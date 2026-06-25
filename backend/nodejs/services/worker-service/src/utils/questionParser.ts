import { createGeneratedQuestion } from "../models/generatedQuestion.ts";
import type { GeneratedQuestion } from "../types/service.ts";

interface RawQuestionEnvelope {
  questions?: Array<{
    question?: string;
    options?: Record<string, string>;
    option_a?: string;
    option_b?: string;
    option_c?: string;
    option_d?: string;
    correct_option?: string;
    explanation?: string;
    difficulty?: string;
    source_file_path?: string;
  }>;
}

function containsNonEnglishText(value: string): boolean {
  return /[\u0080-\uFFFF]/u.test(value);
}

export function parseGeneratedQuestions(rawPayload: string): GeneratedQuestion[] {
  const envelope = JSON.parse(rawPayload) as RawQuestionEnvelope;
  const rawQuestions = Array.isArray(envelope.questions) ? envelope.questions : [];

  if (rawQuestions.length !== 20) {
    throw new Error(`AI output must include exactly 20 questions, got ${rawQuestions.length}.`);
  }

  return rawQuestions.map((question, index) => {
    const normalized = createGeneratedQuestion({
      question: String(question.question ?? ""),
      optionA: String(question.options?.A ?? question.option_a ?? ""),
      optionB: String(question.options?.B ?? question.option_b ?? ""),
      optionC: String(question.options?.C ?? question.option_c ?? ""),
      optionD: String(question.options?.D ?? question.option_d ?? ""),
      correctOption: String(question.correct_option ?? ""),
      explanation: String(question.explanation ?? ""),
      difficulty: String(question.difficulty ?? ""),
      sourceFilePath: String(question.source_file_path ?? "")
    });

    if (
      !normalized.question ||
      !normalized.optionA ||
      !normalized.optionB ||
      !normalized.optionC ||
      !normalized.optionD ||
      !normalized.explanation ||
      !normalized.sourceFilePath
    ) {
      throw new Error(`Question ${index + 1} is missing required fields.`);
    }

    if (!["A", "B", "C", "D"].includes(normalized.correctOption)) {
      throw new Error(`Question ${index + 1} correct_option must be A, B, C, or D.`);
    }

    if (!["easy", "medium", "hard"].includes(normalized.difficulty)) {
      throw new Error(`Question ${index + 1} difficulty must be easy, medium, or hard.`);
    }

    if (
      containsNonEnglishText(
        [
          normalized.question,
          normalized.optionA,
          normalized.optionB,
          normalized.optionC,
          normalized.optionD,
          normalized.explanation
        ].join("")
      )
    ) {
      throw new Error(`Question ${index + 1} contains non-English text.`);
    }

    return normalized;
  });
}
