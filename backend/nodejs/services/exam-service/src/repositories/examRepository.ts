import { randomUUID } from "node:crypto";
import { AppError } from "@backend/microservice-sdk";
import type {
  ExamRecord,
  PreparationJobRecord,
  StoredExamAnswer,
  SucceededProjectRecord
} from "../models/exam.js";
import type { GeneratedQuestionRecord } from "../models/question.js";
import { createPreparationArtifact, type AnalysisJobRecord, type ExamServiceStore } from "../types/service.js";

export class ExamRepository {
  store: ExamServiceStore;

  constructor(store: ExamServiceStore) {
    this.store = store;
  }

  getAnalysisJob(analysisJobId: string) {
    return this.store.analysisJobs.get(analysisJobId) ?? null;
  }

  ensureAnalysisOwnership(userId: string, analysisJobId: string, repositoryId?: string) {
    const job = this.store.analysisJobs.get(analysisJobId);
    if (!job) {
      throw notFound("Analysis job not found.");
    }

    if (job.userId !== userId) {
      throw notFound("Analysis job not found.");
    }

    if (repositoryId && job.repositoryId !== repositoryId) {
      throw notFound("Analysis job not found.");
    }

    return job;
  }

  createExam(input: {
    userId: string;
    analysisJob: AnalysisJobRecord;
    questionIds: string[];
    scheduledAt: string;
    passingScore: number;
  }) {
    const exam: ExamRecord = {
      id: randomUUID(),
      userId: input.userId,
      repositoryId: input.analysisJob.repositoryId,
      analysisJobId: input.analysisJob.analysisJobId,
      projectSlug: input.analysisJob.projectSlug,
      scheduledAt: input.scheduledAt,
      status: "scheduled",
      passingScore: input.passingScore,
      score: null,
      passed: null,
      createdAt: new Date().toISOString(),
      submittedAt: null
    };

    this.store.exams.set(exam.id, exam);
    this.store.examQuestionIdsByExam.set(exam.id, [...input.questionIds]);
    return exam;
  }

  getExam(userId: string, examId: string) {
    const exam = this.store.exams.get(examId);
    if (!exam || exam.userId !== userId) {
      throw notFound("Exam not found.");
    }
    return exam;
  }

  getExamById(examId: string) {
    const exam = this.store.exams.get(examId);
    if (!exam) {
      throw notFound("Exam not found.");
    }
    return exam;
  }

  saveSubmission(examId: string, answers: StoredExamAnswer[], score: number, passed: boolean) {
    const exam = this.getExamById(examId);
    const submittedAt = new Date().toISOString();
    const nextExam: ExamRecord = {
      ...exam,
      status: passed ? "passed" : "failed",
      score,
      passed,
      submittedAt
    };

    this.store.exams.set(examId, nextExam);
    this.store.examAnswersByExam.set(examId, answers);
    return nextExam;
  }

  getResultAnswers(examId: string) {
    return [...(this.store.examAnswersByExam.get(examId) ?? [])];
  }

  listSucceededProjects(userId: string) {
    return [...(this.store.succeededProjectsByUser.get(userId) ?? [])];
  }

  listPreparationJobs(userId: string) {
    return [...(this.store.preparationJobsByUser.get(userId) ?? [])];
  }

  listUserExams(userId: string) {
    return [...this.store.exams.values()]
      .filter((exam) => exam.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  createPreparationJob(input: {
    userId: string;
    projectSlug: string;
    repoUrl: string;
    attemptId: string;
  }) {
    const job: PreparationJobRecord = {
      id: randomUUID(),
      userId: input.userId,
      projectSlug: input.projectSlug,
      repoUrl: input.repoUrl,
      attemptId: input.attemptId,
      status: "pending",
      localPath: null,
      commitHash: null,
      errorMessage: null,
      createdAt: new Date().toISOString(),
      completedAt: null
    };

    const jobs = this.store.preparationJobsByUser.get(input.userId) ?? [];
    this.store.preparationJobsByUser.set(input.userId, [job, ...jobs.filter((item) => item.id !== job.id)]);
    return job;
  }

  completePreparationJob(jobId: string) {
    const updatedJob = this.updatePreparationJob(jobId, (job) => {
      const artifact = createPreparationArtifact(job.projectSlug);
      return {
        ...job,
        status: "completed",
        localPath: artifact.localPath,
        commitHash: artifact.commitHash,
        completedAt: new Date().toISOString(),
        errorMessage: null
      };
    });

    return updatedJob;
  }

  failPreparationJob(jobId: string, errorMessage: string) {
    return this.updatePreparationJob(jobId, (job) => ({
      ...job,
      status: "failed",
      errorMessage,
      completedAt: new Date().toISOString()
    }));
  }

  updatePreparationToDownloading(jobId: string) {
    return this.updatePreparationJob(jobId, (job) => ({
      ...job,
      status: "downloading",
      errorMessage: null
    }));
  }

  createAnalysisJobFromPreparation(project: SucceededProjectRecord, userId: string) {
    const analysisJobId = randomUUID();
    const repositoryId = randomUUID();
    const job: AnalysisJobRecord = {
      analysisJobId,
      userId,
      repositoryId,
      projectSlug: project.projectSlug,
      repoUrl: project.repoUrl,
      createdAt: new Date().toISOString()
    };
    this.store.analysisJobs.set(analysisJobId, job);
    return job;
  }

  seedGeneratedQuestions(analysisJobId: string) {
    if ((this.store.generatedQuestionsByAnalysisJob.get(analysisJobId) ?? []).length > 0) {
      return;
    }

    const questions: GeneratedQuestionRecord[] = Array.from({ length: 20 }, (_, index) => ({
      id: randomUUID(),
      analysisJobId,
      question: `Generated question ${index + 1}`,
      options: {
        A: `Option A${index + 1}`,
        B: `Option B${index + 1}`,
        C: `Option C${index + 1}`,
        D: `Option D${index + 1}`
      },
      correctOption: "A",
      explanation: `Explanation for question ${index + 1}`,
      difficulty: index < 7 ? "easy" : index < 14 ? "medium" : "hard",
      sourceFilePath: `src/example-${index + 1}.ts`,
      createdAt: new Date().toISOString()
    }));
    this.store.generatedQuestionsByAnalysisJob.set(analysisJobId, questions);
  }

  private updatePreparationJob(jobId: string, updater: (job: PreparationJobRecord) => PreparationJobRecord) {
    for (const [userId, jobs] of this.store.preparationJobsByUser.entries()) {
      const index = jobs.findIndex((job) => job.id === jobId);
      if (index === -1) {
        continue;
      }

      const nextJob = updater(jobs[index]);
      const nextJobs = [...jobs];
      nextJobs[index] = nextJob;
      this.store.preparationJobsByUser.set(userId, nextJobs);
      return nextJob;
    }

    throw notFound("Preparation job not found.");
  }
}

function notFound(message: string) {
  return new AppError(message, {
    statusCode: 404,
    code: "NOT_FOUND"
  });
}
