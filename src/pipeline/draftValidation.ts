import type { RepoFacts } from "./repoFacts.js";

export type DraftValidationResult = {
  isValid: boolean;
  issues: string[];
};

export function validateDraftReferences(
  draftText: string,
  repoFacts: RepoFacts,
): DraftValidationResult {
  const issues: string[] = [];
  const symbolSet = new Set(
    repoFacts.symbols.map((symbol) => `${symbol.file}::${symbol.symbol}`),
  );

  const questionChunks = draftText.split(/\n(?=Question\s+\d+:)/g);
  for (const chunk of questionChunks) {
    const questionMatch = chunk.match(/^Question\s+(\d+):/m);
    if (!questionMatch) {
      continue;
    }

    const questionNumber = questionMatch[1];
    const referenceMatch = chunk.match(
      /Code reference:\s*([^\n]+),\s*Symbol:\s*([^\n]+)/i,
    );

    if (!referenceMatch) {
      issues.push(`Question ${questionNumber}: missing or malformed code reference.`);
      continue;
    }

    const file = referenceMatch[1].trim();
    const symbol = referenceMatch[2].trim();
    const key = `${file}::${symbol}`;

    if (!symbolSet.has(key)) {
      issues.push(
        `Question ${questionNumber}: code reference ${file} / ${symbol} does not exist in repository facts.`,
      );
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
