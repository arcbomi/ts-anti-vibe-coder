import path from "node:path";

import type {
  PromptBuilderArgs,
  StagePromptDefinition,
} from "../pipeline/types.js";

const MAX_FILE_COUNT = 40;
const MAX_FILE_CHARS = 1200;
const MAX_PROMPT_SNIPPET_CHARS = 3500;
const MAX_SNAPSHOT_TOTAL_CHARS = 14000;
const MAX_SYMBOL_SNIPPET_CHARS = 1800;
const MAX_SYMBOL_COUNT = 24;

const TEXT_FILE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".txt",
  ".go",
  ".py",
  ".java",
  ".rb",
  ".php",
  ".rs",
  ".sql",
  ".html",
  ".css",
  ".scss",
  ".yaml",
  ".yml",
  ".toml",
  ".sh",
  ".env",
]);

const PRIORITY_PATH_PATTERNS = [
  "cmd/server/",
  "internal/auth/",
  "internal/database/",
  "internal/handlers/",
  "internal/models/",
  "templates/",
  "static/js/",
  "Dockerfile",
  "docker-compose.yml",
  "README.md",
];

export const stagePrompts: Record<string, StagePromptDefinition> = {
  repoInventory: {
    system:
      "You are a repository analysis agent. Report only facts visible in the repository. Do not invent files, functions, behavior, or architecture.",
    outputFileName: "repo-scan.md",
    maxTokens: 2000,
    template: async ({ input, tools }) => {
      const fileList = await getRepositoryFileList(tools, input.repoPath);

      return [
        "Inspect the provided repository folder and produce a factual inventory of the codebase.",
        "",
        "Repository path:",
        input.repoPath,
        "",
        "Project task:",
        clipText(input.projectSubject, MAX_PROMPT_SNIPPET_CHARS),
        "",
        "You must list:",
        "- top-level files and directories",
        "- main entrypoint",
        "- handler/controller files",
        "- database/schema files",
        "- auth/session files",
        "- template files",
        "- static/frontend files",
        "- tests",
        "",
        "Ignore workflow-runner support files if they exist in the same repository. Focus on the target application codebase itself.",
        "",
        "Do not interpret the code yet. Do not propose questions. Do not invent files or behavior.",
        "",
        "Repository files:",
        fileList.join("\n"),
        "",
        "Return this format exactly:",
        "Repository inventory:",
        "- <path>: <what it appears to contain>",
        "",
        "Primary code areas:",
        "- ...",
        "",
        "Potentially relevant files for exam questions:",
        "- ...",
      ].join("\n");
    },
  },
  subjectCodeMapping: {
    system:
      "You are a codebase mapping agent. Only map project requirements to real repository code. Do not invent missing functionality.",
    outputFileName: "subject-map.md",
    maxTokens: 2500,
    template: async ({ input, context, tools }) => {
      const repoOverview = await getRepositoryOverview(tools, input.repoPath);
      const symbolCatalog = await getSymbolCatalog(tools, input.repoPath);
      return [
        "Using the repository inventory and the project task, map each requirement to concrete code locations in the repository.",
        "",
        "Project task:",
        clipText(input.projectSubject, MAX_PROMPT_SNIPPET_CHARS),
        "",
        "Workflow text:",
        clipText(input.workflowText, 2500),
        "",
        "Stage 1 output:",
        clipText(context.outputs["repo-inventory"] ?? "(missing)", 2500),
        "",
        "Repository facts:",
        clipText(context.outputs["repo-facts"] ?? "(missing)", 5000),
        "",
        "Repository overview:",
        repoOverview,
        "",
        "Real symbol catalog:",
        symbolCatalog,
        "",
        "Cover:",
        "- authentication",
        "- SQLite and schema",
        "- posts and comments",
        "- likes and dislikes",
        "- filtering",
        "- notifications if present",
        "- Docker/startup if present",
        "- error handling and HTTP status handling",
        "",
        "For each mapping, give:",
        "- requirement",
        "- code files/functions/templates involved",
        "- why those files are relevant",
        "",
        "Only use real files and exact real symbols from the repository inventory or repository excerpts.",
        "If an exact function or handler name is not shown, do not invent one.",
        "",
        "Return this format exactly:",
        "Requirement mapping:",
        "- Requirement: ...",
        "  Code: ...",
        "  Why relevant: ...",
        "",
        "High-value areas:",
        "- ...",
      ].join("\n");
    },
  },
  candidateSnippets: {
    system:
      "You are a snippet selection agent. Choose only real code from the repository. Prefer snippets that show validation, database writes, permissions, query construction, control flow, or error handling.",
    outputFileName: "candidates.md",
    maxTokens: 4000,
    template: async ({ input, context, tools }) => {
      const symbolCatalog = await getSymbolCatalog(tools, input.repoPath);
      return [
        "Select candidate code snippets from the repository that could become exam questions.",
        "",
        "Project task:",
        clipText(input.projectSubject, 2500),
        "",
        "Stage 1 output:",
        clipText(context.outputs["repo-inventory"] ?? "(missing)", 1800),
        "",
        "Stage 2 output:",
        clipText(context.outputs["subject-code-mapping"] ?? "(missing)", 2200),
        "",
        "Repository facts:",
        clipText(context.outputs["repo-facts"] ?? "(missing)", 6000),
        "",
        "Real symbol catalog:",
        symbolCatalog,
        "",
        "For each candidate, include:",
        "- file path",
        "- function/component/handler name",
        "- exact code snippet, copied from the repository",
        "- why it is a good question candidate",
        "- which project requirement it supports",
        "",
        "Rules:",
        "- choose only snippets that appear verbatim in the repository excerpts",
        "- use exact file paths and exact symbol names only",
        "- if a function is not shown in the excerpts, do not name it",
        "- do not rewrite or improve the code while quoting it",
        "",
        "Prefer snippets that involve:",
        "- write paths",
        "- validation order",
        "- permission checks",
        "- SQL queries or updates",
        "- transaction boundaries",
        "- ignored errors",
        "- async or worker behavior",
        "- template logic tied to code behavior",
        "",
        "Do not write questions yet.",
        "",
        "Return this format exactly:",
        "Candidate snippets:",
        "1.",
        "  File:",
        "  Symbol:",
        "  Snippet:",
        "  Reason:",
        "  Requirement:",
      ].join("\n");
    },
  },
  riskAnalysis: {
    system:
      "You are a bug-risk analysis agent. Focus on concrete code risks visible in the repository. Do not speculate beyond the code.",
    outputFileName: "risk-analysis.md",
    maxTokens: 3000,
    template: async ({ input, context }) => {
      return [
        "Analyze each candidate snippet and identify:",
        "- the key code path",
        "- the bug or risk, if any",
        "- the edge case",
        "- the exact line(s) or branch(es) that matter",
        "- what kind of question the snippet supports",
        "",
        "Classify whether the snippet is best for:",
        "- complete missing code",
        "- choose correct implementation",
        "- choose safest bug fix",
        "- choose correct SQL update/query",
        "- choose correct permission check",
        "- choose correct error handling",
        "- choose correct transaction usage",
        "- choose correct template behavior",
        "- choose behavior-preserving refactor",
        "",
        "Project task:",
        clipText(input.projectSubject, 2500),
        "",
        "Stage 3 output:",
        clipText(context.outputs["candidate-snippets"] ?? "(missing)", 6000),
        "",
        "Do not draft the final questions yet.",
        "",
        "Return this format exactly:",
        "Risk analysis:",
        "- File:",
        "  Symbol:",
        "  Risk:",
        "  Edge case:",
        "  Question types:",
        "  Notes:",
      ].join("\n");
    },
  },
  questionPlan: {
    system:
      "You are a question planning agent. Create a balanced exam plan from the analyzed repository. Do not write the final questions.",
    outputFileName: "question-plan.md",
    maxTokens: 3000,
    template: async ({ input, context }) => {
      return [
        "Create a question plan for a programming-skill exam based on the repository and task.",
        "",
        "Project task:",
        clipText(input.projectSubject, 2200),
        "",
        "Stage 2 output:",
        clipText(context.outputs["subject-code-mapping"] ?? "(missing)", 2200),
        "",
        "Stage 3 output:",
        clipText(context.outputs["candidate-snippets"] ?? "(missing)", 4500),
        "",
        "Repository facts:",
        clipText(context.outputs["repo-facts"] ?? "(missing)", 5000),
        "",
        "Stage 4 output:",
        clipText(context.outputs["risk-analysis"] ?? "(missing)", 3500),
        "",
        "The plan must specify for each question:",
        "- target file",
        "- target function/component/handler",
        "- question type",
        "- difficulty",
        "- main concept tested",
        "- why the snippet is suitable",
        "- what wrong-answer traps to include",
        "",
        "Rules:",
        "- every target symbol must already appear in Stage 3 candidate snippets",
        "- do not introduce new handlers, functions, or files here",
        "- if coverage is insufficient, reuse a verified candidate rather than inventing a new one",
        "",
        "Balance the plan across:",
        "- authentication/session logic",
        "- database schema and queries",
        "- posts/comments",
        "- likes/dislikes",
        "- filtering",
        "- error handling",
        "- async/background behavior",
        "- template behavior",
        "",
        "Do not write the final question text yet.",
        "",
        "Return this format exactly:",
        "Question plan:",
        "1.",
        "  File:",
        "  Symbol:",
        "  Type:",
        "  Difficulty:",
        "  Concept:",
        "  Trap ideas:",
      ].join("\n");
    },
  },
  draftQuestions: {
    system:
      "You are a programming-skill question drafter. Use only real repository code. Each draft must have one correct option and plausible wrong options.",
    outputFileName: "draft-questions.md",
    maxTokens: 2800,
    template: async ({ input, context, tools }) => {
      const symbolCatalog = await getSymbolCatalog(tools, input.repoPath);
      return [
        "Draft the multiple-choice questions from the approved question plan.",
        "",
        "Project task:",
        clipText(input.projectSubject, 1400),
        "",
        "Question plan:",
        clipText(context.outputs["question-plan"] ?? "(missing)", 2600),
        "",
        "Candidate snippets:",
        clipText(context.outputs["candidate-snippets"] ?? "(missing)", 2600),
        "",
        "Repository facts:",
        clipText(context.outputs["repo-facts"] ?? "(missing)", 5000),
        "",
        "Real symbol catalog:",
        clipText(symbolCatalog, 5500),
        "",
        "For each question:",
        "- include a short code context copied from the repository",
        "- state the task clearly",
        "- provide A/B/C/D code options",
        "- ensure exactly one correct answer",
        "- make the wrong answers plausible but incorrect",
        "- include a code reference with file path and symbol name",
        "",
        "Rules:",
        "- every file path and symbol must already appear in the question plan",
        "- every code context snippet must be copied verbatim from repository excerpts",
        "- do not invent missing code context",
        "",
        "Do not verify the drafts against the repository yet.",
        "Do not output more than the planned number of questions.",
        "Be concise. Avoid long prose around each draft.",
        "",
        "Return this format exactly:",
        "Draft questions:",
        "Question 1:",
        "...",
      ].join("\n");
    },
  },
  verification: {
    system:
      "You are a verification agent. Check every draft against the repository. Do not assume a draft is correct unless the code proves it.",
    outputFileName: "verification.md",
    maxTokens: 2200,
    template: async ({ input, context, tools }) => {
      const symbolCatalog = await getSymbolCatalog(tools, input.repoPath);
      return [
        "Verify each draft question against the repository.",
        "",
        "Draft questions:",
        clipText(context.outputs["draft-questions"] ?? "(missing)", 4200),
        "",
        "Draft reference validation:",
        clipText(context.outputs["draft-reference-validation"] ?? "(missing)", 2000),
        "",
        "Real symbol catalog:",
        clipText(symbolCatalog, 4500),
        "",
        "For each question, report:",
        "- whether the correct answer is truly correct",
        "- whether each wrong option is actually wrong",
        "- whether the snippet is real and copied accurately",
        "- whether the difficulty matches the intended level",
        "- whether the question asks for code reasoning rather than pure description",
        "",
        "If any file path, symbol, or code context does not exist in the repository excerpts, mark the question as fail.",
        "",
        "If something is wrong, say exactly what must be fixed.",
        "Do not rewrite the final questions yet.",
        "",
        "Return this format exactly:",
        "Verification report:",
        "- Question 1: pass/fail",
        "  Issues:",
        "  Required fixes:",
      ].join("\n");
    },
  },
  finalQuestions: {
    system:
      "You are a final exam generator. Use only verified repository facts and verified question drafts. Generate exactly 20 English-only A/B/C/D questions. Do not invent any code, files, functions, tables, or behavior.",
    outputFileName: "final-questions.md",
    maxTokens: 8000,
    template: async ({ input, context, tools }) => {
      const symbolCatalog = await getSymbolCatalog(tools, input.repoPath);
      return [
        "Generate the final programming-skill exam questions for the repository.",
        "",
        "Project task:",
        clipText(input.projectSubject, 2000),
        "",
        "Question plan:",
        clipText(context.outputs["question-plan"] ?? "(missing)", 3000),
        "",
        "Draft questions:",
        clipText(context.outputs["draft-questions"] ?? "(missing)", 5000),
        "",
        "Verification report:",
        clipText(context.outputs["verification"] ?? "(missing)", 3000),
        "",
        "Draft reference validation:",
        clipText(context.outputs["draft-reference-validation"] ?? "(missing)", 2000),
        "",
        "Real symbol catalog:",
        symbolCatalog,
        "",
        "Requirements:",
        "- exactly 20 questions",
        "- English only",
        "- A/B/C/D only",
        "- exactly one correct answer per question",
        "- every question must include real code context copied from the repository",
        "- every question must include a code reference",
        "- every question must ask the student to write, fix, complete, choose, or preserve code behavior",
        "- do not ask only “what happens?”",
        "- do not ask product-flow-only questions",
        "- do not ask architecture/design-only questions",
        "- do not ask generic theory questions",
        "- do not invent files, symbols, tables, variables, or behavior",
        "- provide the correct answer and explanation for each question",
        "",
        "Use only file paths, symbols, and code contexts that already passed verification.",
        "",
        "Use the verified drafts as the source of truth. This is the only stage that outputs the final questions.",
        "",
        "Return this format exactly:",
        "Question 1:",
        "<question text>",
        "",
        "Code context:",
        "```<language>",
        "<real code copied from repository>",
        "```",
        "",
        "Task:",
        "<what the student must write/fix/choose>",
        "",
        "A.",
        "```<language>",
        "<option A>",
        "```",
        "",
        "B.",
        "```<language>",
        "<option B>",
        "```",
        "",
        "C.",
        "```<language>",
        "<option C>",
        "```",
        "",
        "D.",
        "```<language>",
        "<option D>",
        "```",
        "",
        "Code reference:",
        "",
        "* File: `<real repository path>`",
        '* Function/component/handler: `<real symbol or "top-level code">`',
        "* Related logic: `<specific condition, variable, query, return, mutation, or error path>`",
        "",
        "Correct answer: <A/B/C/D>",
        "",
        "Explanation:",
        "<explain why the correct option matches the real code and why the others are wrong>",
        "",
        "Question 20:",
        "...",
        "",
        "# Final Quality Check",
        "Check:",
        "- exactly 20 questions",
        "- no invented files",
        "- no invented functions",
        "- no invented tables or columns",
        "- every snippet copied from the repository",
        "- every answer has exactly one correct option",
        "- at least half of questions ask how to write, fix, complete, or choose code",
        "- not all questions ask “what happens”",
        "- explanations match the code",
        "- code references are real and precise",
      ].join("\n");
    },
  },
};

async function getRepositoryFileList(
  tools: PromptBuilderArgs["tools"],
  repoPath: string,
): Promise<string[]> {
  const files = prioritizeFiles(await tools.listFiles(repoPath));
  return files
    .filter((filePath) => !shouldSkipFile(filePath))
    .map((filePath) => path.relative(repoPath, filePath))
    .slice(0, MAX_FILE_COUNT);
}

async function getRepositoryOverview(
  tools: PromptBuilderArgs["tools"],
  repoPath: string,
): Promise<string> {
  const files = await getRepositoryFileList(tools, repoPath);
  return files.map((filePath) => `- ${filePath}`).join("\n");
}

async function getRepositorySnapshot(
  tools: PromptBuilderArgs["tools"],
  repoPath: string,
): Promise<string> {
  const files = prioritizeFiles(await tools.listFiles(repoPath));
  const selectedFiles = files.filter((filePath) => isPromptFriendlyFile(filePath)).slice(0, MAX_FILE_COUNT);

  const chunks: string[] = [];
  let totalChars = 0;
  for (const filePath of selectedFiles) {
    const relativePath = path.relative(repoPath, filePath);
    const ext = path.extname(filePath).slice(1) || "txt";
    const raw = await tools.readFile(filePath);
    const content = raw.length > MAX_FILE_CHARS ? `${raw.slice(0, MAX_FILE_CHARS)}\n...<truncated>` : raw;
    const chunk = [
      `File: ${relativePath}`,
      `\`\`\`${ext}`,
      content,
      "```",
    ].join("\n");

    if (totalChars + chunk.length > MAX_SNAPSHOT_TOTAL_CHARS) {
      break;
    }

    chunks.push(chunk);
    totalChars += chunk.length + 2;
  }

  return chunks.join("\n\n");
}

async function getSymbolCatalog(
  tools: PromptBuilderArgs["tools"],
  repoPath: string,
): Promise<string> {
  const files = prioritizeFiles(await tools.listFiles(repoPath));
  const candidates = files
    .filter((filePath) => isPromptFriendlyFile(filePath))
    .filter((filePath) => {
      const normalized = filePath.replaceAll("\\", "/");
      return (
        normalized.includes("/internal/") ||
        normalized.endsWith("/cmd/server/main.go") ||
        normalized.includes("/templates/")
      );
    })
    .slice(0, MAX_FILE_COUNT);

  const entries: string[] = [];
  for (const filePath of candidates) {
    const relativePath = path.relative(repoPath, filePath);
    const raw = await tools.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".go") {
      const goSymbols = extractGoFunctions(raw, relativePath);
      entries.push(...goSymbols);
    } else if (ext === ".html") {
      entries.push(formatFileExcerpt(relativePath, raw, "html"));
    }

    if (entries.length >= MAX_SYMBOL_COUNT) {
      break;
    }
  }

  return entries.slice(0, MAX_SYMBOL_COUNT).join("\n\n");
}

function extractGoFunctions(content: string, relativePath: string): string[] {
  const matches = [...content.matchAll(/^func\s+([A-Za-z0-9_]+)\s*\(/gm)];
  const snippets: string[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const symbol = match[1];
    const start = match.index ?? 0;
    const end =
      index + 1 < matches.length
        ? (matches[index + 1].index ?? content.length)
        : content.length;
    const rawSnippet = content.slice(start, end).trim();
    const snippet = clipText(rawSnippet, MAX_SYMBOL_SNIPPET_CHARS);

    snippets.push(
      [
        `File: ${relativePath}`,
        `Symbol: ${symbol}`,
        "```go",
        snippet,
        "```",
      ].join("\n"),
    );
  }

  return snippets;
}

function formatFileExcerpt(
  relativePath: string,
  content: string,
  language: string,
): string {
  return [
    `File: ${relativePath}`,
    "Symbol: top-level template",
    `\`\`\`${language}`,
    clipText(content.trim(), MAX_SYMBOL_SNIPPET_CHARS),
    "```",
  ].join("\n");
}

function clipText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}\n...<truncated>`;
}

function isPromptFriendlyFile(filePath: string): boolean {
  if (shouldSkipFile(filePath)) {
    return false;
  }

  return TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function shouldSkipFile(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  return (
    normalized.includes("/node_modules/") ||
    normalized.includes("/dist/") ||
    normalized.includes("/outputs/") ||
    normalized.includes("/.git/") ||
    normalized.endsWith("/package.json") ||
    normalized.endsWith("/package-lock.json") ||
    normalized.endsWith("/tsconfig.json") ||
    normalized.endsWith("/README.workflow-runner.md") ||
    normalized.endsWith("/subject.txt") ||
    normalized.endsWith("/QUESTION_GENERATION_WORKFLOW.md") ||
    normalized.endsWith("/QUESTION_GENERATION_STAGED_WORKFLOW.md") ||
    normalized.includes("/src/") ||
    normalized.includes("/.env")
  );
}

function prioritizeFiles(filePaths: string[]): string[] {
  return [...filePaths].sort((left, right) => {
    const leftScore = getPriorityScore(left);
    const rightScore = getPriorityScore(right);
    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }
    return left.localeCompare(right);
  });
}

function getPriorityScore(filePath: string): number {
  const normalized = filePath.replaceAll("\\", "/");
  const index = PRIORITY_PATH_PATTERNS.findIndex((pattern) =>
    normalized.includes(pattern),
  );
  return index === -1 ? PRIORITY_PATH_PATTERNS.length : index;
}
