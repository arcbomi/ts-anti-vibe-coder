import type { GeneratedQuestion } from "../types/service.ts";

export function createGeneratedQuestion(input: GeneratedQuestion): GeneratedQuestion {
  return {
    question: input.question.trim(),
    optionA: input.optionA.trim(),
    optionB: input.optionB.trim(),
    optionC: input.optionC.trim(),
    optionD: input.optionD.trim(),
    correctOption: input.correctOption.trim().toUpperCase(),
    explanation: input.explanation.trim(),
    difficulty: input.difficulty.trim().toLowerCase(),
    sourceFilePath: input.sourceFilePath.trim()
  };
}
