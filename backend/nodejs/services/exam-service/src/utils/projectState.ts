import type { ExamRecord, PreparationJobRecord, SucceededProject, SucceededProjectRecord } from "../models/exam.js";

export function sanitizeProjectSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^-+|-+$/g, "");
}

export function buildProjectState(input: {
  project: SucceededProjectRecord;
  jobs: PreparationJobRecord[];
  exam?: ExamRecord;
}): SucceededProject {
  const matchingJob = input.jobs.find((job) => job.projectSlug === input.project.projectSlug);
  const exam = input.exam;

  let preparationStatus = "not_started";
  let preparationErrorMessage: string | undefined;
  let examId: string | undefined;

  if (matchingJob?.status === "downloading" || matchingJob?.status === "pending") {
    preparationStatus = "preparing";
  } else if (matchingJob?.status === "failed") {
    preparationStatus = "failed_generation";
    preparationErrorMessage = matchingJob.errorMessage ?? undefined;
  } else if (matchingJob?.status === "completed") {
    preparationStatus = "ready_to_pass";
  }

  if (exam) {
    examId = exam.id;
    if (exam.passed) {
      preparationStatus = "passed";
    } else if (exam.submittedAt && exam.passed === false) {
      preparationStatus = "failed";
    } else {
      preparationStatus = "ready_to_pass";
    }
  }

  return {
    project_slug: input.project.projectSlug,
    project_name: input.project.projectName,
    project_status: input.project.projectStatus,
    repo_url: input.project.repoUrl,
    ...(input.project.auditText ? { audit_text: input.project.auditText } : {}),
    preparation_status: preparationStatus,
    ...(preparationErrorMessage ? { preparation_error_message: preparationErrorMessage } : {}),
    ...(examId ? { exam_id: examId } : {})
  };
}
