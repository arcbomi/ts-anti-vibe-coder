import type { QuestionOptionKey } from "./question.js";

export const EXAM_STATUSES = [
  "scheduled",
  "ready_to_pass",
  "submitted",
  "passed",
  "failed"
] as const;

export const PREPARATION_STATUSES = ["pending", "downloading", "completed", "failed"] as const;

export type ExamStatus = (typeof EXAM_STATUSES)[number];
export type PreparationStatus = (typeof PREPARATION_STATUSES)[number];

export type CreateExamRequest = {
  analysis_job_id: string;
  repository_id?: string;
  scheduled_at?: string;
};

export type CreateExamResponse = {
  id: string;
  exam_id: string;
  analysis_job_id: string;
  status: string;
  question_count: number;
};

export type ExamRecord = {
  id: string;
  userId: string;
  repositoryId: string;
  analysisJobId: string;
  projectSlug: string;
  scheduledAt: string;
  status: ExamStatus;
  passingScore: number;
  score: number | null;
  passed: boolean | null;
  createdAt: string;
  submittedAt: string | null;
};

export type PublicExamQuestion = {
  id: string;
  question_id?: string;
  index: number;
  question: string;
  options: Record<string, string>;
  difficulty: string;
  source_file_path: string;
};

export type ExamResponse = {
  id: string;
  exam_id: string;
  attempt_id: string;
  project_slug: string;
  user_id?: string;
  repository_id?: string;
  analysis_job_id?: string;
  scheduled_at: string;
  status: string;
  score?: number;
  passed?: boolean;
  submitted_at?: string;
  questions?: PublicExamQuestion[];
};

export type SubmittedAnswerInput = {
  question_id: string;
  selected_option: string;
};

export type SubmitExamRequest = {
  answers: SubmittedAnswerInput[];
};

export type StoredExamAnswer = {
  id: string;
  examId: string;
  questionId: string;
  selectedOption: QuestionOptionKey;
  isCorrect: boolean;
  correctOption: QuestionOptionKey;
  explanation: string;
  createdAt: string;
};

export type ResultAnswer = {
  question_id: string;
  selected_option: string;
  is_correct: boolean;
  correct_option: string;
  explanation: string;
};

export type ResultResponse = {
  id: string;
  exam_id: string;
  attempt_id: string;
  project_slug: string;
  submitted?: boolean;
  total: number;
  total_questions: number;
  correct_count: number;
  score: number;
  passed: boolean;
  passing_score: number;
  status: string;
  answers?: ResultAnswer[];
};

export type SucceededProjectRecord = {
  userId: string;
  projectSlug: string;
  projectName: string;
  projectStatus: string;
  repoUrl: string;
  auditText: string;
};

export type SucceededProject = {
  project_slug: string;
  project_name: string;
  project_status: string;
  repo_url: string;
  audit_text?: string;
  preparation_status: string;
  preparation_error_message?: string;
  exam_id?: string;
};

export type SucceededProjectsResponse = {
  projects: SucceededProject[];
};

export type PrepareSucceededProjectRequest = {
  user_id: string;
  project_slug: string;
  repo_url: string;
  attempt_id: string;
};

export type PreparationJobRecord = {
  id: string;
  userId: string;
  projectSlug: string;
  repoUrl: string;
  attemptId: string;
  status: PreparationStatus;
  localPath: string | null;
  commitHash: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type PrepareSucceededProjectResponse = {
  job_id: string;
  attempt_id: string;
  status: string;
  project_slug: string;
};

export type StartSucceededProjectPreparationResponse = {
  project_slug: string;
  preparation_status: string;
  attempt_id: string;
};
