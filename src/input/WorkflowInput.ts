import { access, readFile } from "node:fs/promises";

export type WorkflowInput = {
  repoPath: string;
  projectSubject: string;
  workflowText: string;
  previousStageOutputs?: Record<string, unknown>;
  outputDir?: string;
  generateFinalQuestions?: boolean;
};

type LoadWorkflowInputOptions = {
  repoPath?: string;
  projectSubject?: string;
  projectSubjectPath?: string;
  workflowPath?: string;
  outputDir?: string;
  generateFinalQuestions?: boolean;
  previousStageOutputs?: Record<string, unknown>;
};

export async function loadWorkflowInput(
  options: LoadWorkflowInputOptions = {},
): Promise<WorkflowInput> {
  const repoPath = options.repoPath ?? process.env.REPO_PATH ?? "./forum";
  const workflowPath =
    options.workflowPath ??
    process.env.WORKFLOW_PATH ??
    "./QUESTION_GENERATION_STAGED_WORKFLOW.md";
  const outputDir = options.outputDir ?? process.env.OUTPUT_DIR ?? "./outputs";
  const generateFinalQuestions =
    options.generateFinalQuestions ??
    process.env.GENERATE_FINAL === "true";

  const projectSubject = await resolveProjectSubject({
    inlineSubject: options.projectSubject ?? process.env.PROJECT_SUBJECT,
    subjectPath: options.projectSubjectPath ?? process.env.PROJECT_SUBJECT_PATH,
  });

  const workflowText = await readFile(workflowPath, "utf8");

  return {
    repoPath,
    projectSubject,
    workflowText,
    previousStageOutputs: options.previousStageOutputs,
    outputDir,
    generateFinalQuestions,
  };
}

async function resolveProjectSubject(input: {
  inlineSubject?: string;
  subjectPath?: string;
}): Promise<string> {
  if (input.inlineSubject && input.inlineSubject.trim().length > 0) {
    return input.inlineSubject.trim();
  }

  if (input.subjectPath) {
    await access(input.subjectPath);
    return await readFile(input.subjectPath, "utf8");
  }

  throw new Error(
    "Project subject is required. Set PROJECT_SUBJECT or PROJECT_SUBJECT_PATH.",
  );
}
