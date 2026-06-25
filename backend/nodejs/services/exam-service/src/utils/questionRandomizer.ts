import type { GeneratedQuestionRecord, QuestionOptionKey } from "../models/question.js";

export function shuffleQuestions(questions: GeneratedQuestionRecord[]) {
  return fisherYates([...questions]);
}

export function shuffleOptionKeys(optionKeys: QuestionOptionKey[]) {
  return fisherYates([...optionKeys]);
}

function fisherYates<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }

  return items;
}
