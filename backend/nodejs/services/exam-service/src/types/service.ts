import { randomUUID } from "node:crypto";
import type { PreparationJobRecord, StoredExamAnswer, ExamRecord, SucceededProjectRecord } from "../models/exam.js";
import type { ExamQuestionOptionRecord, GeneratedQuestionRecord } from "../models/question.js";

export type ExamServiceConfig = {
  serviceName: string;
  port: number;
  internalToken: string;
  passingScore: number;
  examOpenDay: string;
};

export type AuthenticatedUser = {
  userId: string;
};

export type AnalysisJobRecord = {
  analysisJobId: string;
  userId: string;
  repositoryId: string;
  projectSlug: string;
  repoUrl: string;
  createdAt: string;
};

export type ExamServiceStore = {
  analysisJobs: Map<string, AnalysisJobRecord>;
  generatedQuestionsByAnalysisJob: Map<string, GeneratedQuestionRecord[]>;
  exams: Map<string, ExamRecord>;
  examQuestionIdsByExam: Map<string, string[]>;
  examOptionMappingsByExam: Map<string, ExamQuestionOptionRecord[]>;
  examAnswersByExam: Map<string, StoredExamAnswer[]>;
  succeededProjectsByUser: Map<string, SucceededProjectRecord[]>;
  preparationJobsByUser: Map<string, PreparationJobRecord[]>;
};

export function createExamServiceStore(): ExamServiceStore {
  return {
    analysisJobs: new Map(),
    generatedQuestionsByAnalysisJob: new Map(),
    exams: new Map(),
    examQuestionIdsByExam: new Map(),
    examOptionMappingsByExam: new Map(),
    examAnswersByExam: new Map(),
    succeededProjectsByUser: new Map(),
    preparationJobsByUser: new Map()
  };
}

export function upsertPreparationJob(store: ExamServiceStore, job: PreparationJobRecord) {
  const jobs = store.preparationJobsByUser.get(job.userId) ?? [];
  const nextJobs = jobs.filter((item) => item.id !== job.id);
  nextJobs.unshift(job);
  store.preparationJobsByUser.set(job.userId, nextJobs);
}

export function upsertSucceededProject(store: ExamServiceStore, project: SucceededProjectRecord) {
  const projects = store.succeededProjectsByUser.get(project.userId) ?? [];
  const nextProjects = projects.filter((item) => item.projectSlug !== project.projectSlug);
  nextProjects.push(project);
  store.succeededProjectsByUser.set(project.userId, nextProjects);
}

export function createPreparationArtifact(projectSlug: string) {
  return {
    localPath: `/tmp/prepared/${projectSlug}`,
    commitHash: randomUUID().replaceAll("-", "").slice(0, 12)
  };
}
