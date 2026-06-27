import { randomUUID } from "node:crypto";
import { AppError } from "@backend/microservice-sdk";
import { QUESTION_OPTION_KEYS, type ExamQuestionOptionRecord, type GeneratedQuestionRecord } from "../models/question.js";
import type { ExamServiceStore } from "../types/service.js";

type AnalysisJobMetadata = {
  analysisJobId: string;
  userId: string;
  repositoryId: string;
  projectSlug: string;
  repoUrl: string;
};

export class QuestionRepository {
  store: ExamServiceStore;

  constructor(store: ExamServiceStore) {
    this.store = store;
  }

  replaceGeneratedQuestions(analysisJobId: string, questions: GeneratedQuestionRecord[]) {
    this.store.generatedQuestionsByAnalysisJob.set(analysisJobId, [...questions]);
    return questions.length;
  }

  saveAnalysisJobMetadata(metadata: AnalysisJobMetadata) {
    this.store.analysisJobs.set(metadata.analysisJobId, {
      ...metadata,
      createdAt: new Date().toISOString()
    });
  }

  saveSucceededProject(input: {
    userId: string;
    projectSlug: string;
    repoUrl: string;
  }) {
    const current = this.store.succeededProjectsByUser.get(input.userId) ?? [];
    const next = current.filter((project) => project.projectSlug !== input.projectSlug);
    next.push({
      userId: input.userId,
      projectSlug: input.projectSlug,
      projectName: humanizeProjectSlug(input.projectSlug),
      projectStatus: "succeeded",
      repoUrl: input.repoUrl,
      auditText: ""
    });
    this.store.succeededProjectsByUser.set(input.userId, next);
  }

  getQuestionsByAnalysisJob(userId: string, analysisJobId: string) {
    const owner = this.store.analysisJobs.get(analysisJobId);
    if (!owner || owner.userId !== userId) {
      throw notFound("Questions not found.");
    }

    const questions = this.store.generatedQuestionsByAnalysisJob.get(analysisJobId) ?? [];
    if (questions.length === 0) {
      throw notFound("Questions not found.");
    }

    return [...questions];
  }

  getQuestionsByExam(userId: string, examId: string) {
    const exam = this.store.exams.get(examId);
    if (!exam || exam.userId !== userId) {
      throw notFound("Exam questions not found.");
    }

    return this.getQuestionsByExamInternal(examId);
  }

  getQuestionsByExamInternal(examId: string) {
    const exam = this.store.exams.get(examId);
    if (!exam) {
      throw notFound("Exam questions not found.");
    }

    const questionIds = this.store.examQuestionIdsByExam.get(examId) ?? [];
    const questions = this.store.generatedQuestionsByAnalysisJob.get(exam.analysisJobId) ?? [];
    const questionById = new Map(questions.map((question) => [question.id, question]));
    const orderedQuestions = questionIds
      .map((questionId) => questionById.get(questionId))
      .filter((question): question is GeneratedQuestionRecord => Boolean(question));

    if (orderedQuestions.length === 0) {
      throw notFound("Exam questions not found.");
    }

    return orderedQuestions;
  }

  getExamOptionMappings(examId: string) {
    return [...(this.store.examOptionMappingsByExam.get(examId) ?? [])];
  }

  saveExamOptionMappings(examId: string, mappings: ExamQuestionOptionRecord[]) {
    const normalizedMappings = mappings.map((mapping) => ({
      ...mapping,
      id: mapping.id || randomUUID(),
      examId
    }));
    this.store.examOptionMappingsByExam.set(examId, normalizedMappings);
    return normalizedMappings;
  }

  buildOptionMappings(examId: string, questions: GeneratedQuestionRecord[]) {
    const mappings: ExamQuestionOptionRecord[] = [];
    for (const question of questions) {
      const originals = shuffleOptionKeys();
      originals.forEach((originalOption, index) => {
        const displayOption = QUESTION_OPTION_KEYS[index];
        mappings.push({
          id: randomUUID(),
          examId,
          questionId: question.id,
          displayOption,
          originalOption,
          optionText: question.options[originalOption]
        });
      });
    }
    return this.saveExamOptionMappings(examId, mappings);
  }
}

function shuffleOptionKeys() {
  const keys = [...QUESTION_OPTION_KEYS];
  for (let index = keys.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [keys[index], keys[swapIndex]] = [keys[swapIndex], keys[index]];
  }
  return keys;
}

function notFound(message: string) {
  return new AppError(message, {
    statusCode: 404,
    code: "NOT_FOUND"
  });
}

function humanizeProjectSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
