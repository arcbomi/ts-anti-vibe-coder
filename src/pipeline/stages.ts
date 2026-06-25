import { validateDraftReferences } from "./draftValidation.js";
import { buildRepoFacts, formatRepoFactsMarkdown } from "./repoFacts.js";
import { stagePrompts } from "../prompts/stagePrompts.js";
import type { WorkflowStage } from "./types.js";

export function createStages(): WorkflowStage[] {
  return [
    {
      id: "repo-facts",
      name: "Repository facts catalog",
      system: "",
      outputFileName: "00-repo-facts.md",
      run: async ({ input, context, tools }) => {
        const repoFacts = await buildRepoFacts(tools, input.repoPath);
        context.parsedOutputs["repo-facts"] = repoFacts;
        return formatRepoFactsMarkdown(repoFacts);
      },
    },
    makeStage("repo-inventory", "Repository inventory", stagePrompts.repoInventory),
    makeStage(
      "subject-code-mapping",
      "Subject-to-code mapping",
      stagePrompts.subjectCodeMapping,
    ),
    makeStage(
      "candidate-snippets",
      "Candidate snippet extraction",
      stagePrompts.candidateSnippets,
    ),
    makeStage("risk-analysis", "Bug-risk and edge-case analysis", stagePrompts.riskAnalysis),
    makeStage("question-plan", "Question planning", stagePrompts.questionPlan),
    makeStage("draft-questions", "Draft questions and answer options", stagePrompts.draftQuestions),
    {
      id: "draft-reference-validation",
      name: "Draft reference validation",
      system: "",
      outputFileName: "07-reference-validation.md",
      run: async ({ context }) => {
        const repoFacts = context.parsedOutputs["repo-facts"];
        if (!repoFacts || typeof repoFacts !== "object") {
          throw new Error("Repository facts are missing.");
        }

        const draftText = context.outputs["draft-questions"];
        if (!draftText) {
          throw new Error("Draft questions output is missing.");
        }

        const result = validateDraftReferences(
          draftText,
          repoFacts as Awaited<ReturnType<typeof buildRepoFacts>>,
        );

        const lines = [
          "# Draft Reference Validation",
          "",
          `Valid: ${result.isValid ? "yes" : "no"}`,
          "",
          "Issues:",
          ...(result.issues.length > 0 ? result.issues.map((issue) => `- ${issue}`) : ["- none"]),
        ];

        if (!result.isValid) {
          throw new Error(lines.join("\n"));
        }

        return lines.join("\n");
      },
    },
    makeStage("verification", "Answer and difficulty verification", stagePrompts.verification),
    {
      ...makeStage("final-questions", "Final question generation", stagePrompts.finalQuestions),
      enabled: (input) => input.generateFinalQuestions === true,
    },
  ];
}

function makeStage(
  id: string,
  name: string,
  promptDefinition: {
    system: string;
    outputFileName: string;
    template: WorkflowStage["buildPrompt"];
    temperature?: number;
    maxTokens?: number;
  },
): WorkflowStage {
  return {
    id,
    name,
    system: promptDefinition.system,
    outputFileName: promptDefinition.outputFileName,
    buildPrompt: promptDefinition.template,
    temperature: promptDefinition.temperature,
    maxTokens: promptDefinition.maxTokens,
  };
}
