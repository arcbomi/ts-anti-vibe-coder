import { AppError } from "@backend/microservice-sdk";
import {
  QUESTION_COUNT,
  QUESTION_OPTION_KEYS,
  type AnswerKeyResponse,
  type QuestionsResponse,
  type SaveGeneratedQuestionsRequest,
  type SaveGeneratedQuestionsResponse
} from "../models/question.js";
import { QuestionRepository } from "../repositories/questionRepository.js";
import { toAnswerKey, toGeneratedQuestionRecord, toMappedPublicQuestion, toPublicQuestion } from "../utils/questionMapper.js";
import { shuffleQuestions } from "../utils/questionRandomizer.js";
import { validateQuestionLookup, validateSaveGeneratedQuestionsRequest } from "../validation/questionValidation.js";

export class QuestionService {
  repository: QuestionRepository;

  constructor(repository: QuestionRepository) {
    this.repository = repository;
  }

  saveGeneratedQuestions(payload: SaveGeneratedQuestionsRequest): SaveGeneratedQuestionsResponse {
    const validated = validateSaveGeneratedQuestionsRequest(payload);
    const questions = validated.questions.map((question) =>
      toGeneratedQuestionRecord(validated.analysis_job_id, question)
    );

    const savedCount = this.repository.replaceGeneratedQuestions(validated.analysis_job_id, questions);

    if (validated.user_id && validated.repository_id) {
      this.repository.saveAnalysisJobMetadata({
        analysisJobId: validated.analysis_job_id,
        userId: validated.user_id,
        repositoryId: validated.repository_id,
        projectSlug: validated.project_slug?.trim() || validated.analysis_job_id,
        repoUrl: validated.repo_url?.trim() || ""
      });

      if (validated.project_slug?.trim()) {
        this.repository.saveSucceededProject({
          userId: validated.user_id,
          projectSlug: validated.project_slug.trim(),
          repoUrl: validated.repo_url?.trim() || ""
        });
      }
    }

    return { saved_count: savedCount };
  }

  getQuestionsByAnalysisJob(userId: string, analysisJobId: string): QuestionsResponse {
    validateQuestionLookup(userId, analysisJobId, "analysis job id");
    const questions = this.repository.getQuestionsByAnalysisJob(userId, analysisJobId);
    const questionDtos = questions.map((question) => toPublicQuestion(question, true));

    return {
      id: analysisJobId,
      analysis_job_id: analysisJobId,
      questions_count: questionDtos.length,
      questions: questionDtos
    };
  }

  getExamQuestions(userId: string, examId: string): QuestionsResponse {
    validateQuestionLookup(userId, examId, "exam id");
    const questions = this.repository.getQuestionsByExam(userId, examId);
    const mappings = this.ensureExamOptionMappings(examId, questions);
    const mappingByQuestionId = new Map<string, typeof mappings>();

    for (const question of questions) {
      mappingByQuestionId.set(
        question.id,
        mappings.filter((mapping) => mapping.questionId === question.id)
      );
    }

    const questionDtos = shuffleQuestions(questions).map((question) =>
      toMappedPublicQuestion(question, mappingByQuestionId.get(question.id) ?? [])
    );

    return {
      id: examId,
      exam_id: examId,
      questions_count: questionDtos.length,
      questions: questionDtos
    };
  }

  getAnswerKey(examId: string): AnswerKeyResponse {
    validateQuestionLookup("00000000-0000-4000-8000-000000000000", examId, "exam id");
    const questions = this.repository.getQuestionsByExamInternal(examId);
    const mappings = this.ensureExamOptionMappings(examId, questions);
    const answers = questions.map((question) =>
      toAnswerKey(
        question,
        mappings.filter((mapping) => mapping.questionId === question.id)
      )
    );

    return { answers };
  }

  private ensureExamOptionMappings(examId: string, questions: ReturnType<QuestionRepository["getQuestionsByExamInternal"]>) {
    const existing = this.repository.getExamOptionMappings(examId);
    if (this.hasCompleteMappings(existing, questions.map((question) => question.id))) {
      return existing;
    }

    return this.repository.buildOptionMappings(examId, questions);
  }

  private hasCompleteMappings(mappings: ReturnType<QuestionRepository["getExamOptionMappings"]>, questionIds: string[]) {
    if (mappings.length !== questionIds.length * QUESTION_COUNT / QUESTION_COUNT * QUESTION_OPTION_KEYS.length) {
      return false;
    }

    const counts = new Map<string, number>();
    for (const mapping of mappings) {
      counts.set(mapping.questionId, (counts.get(mapping.questionId) ?? 0) + 1);
    }

    return questionIds.every((questionId) => counts.get(questionId) === QUESTION_OPTION_KEYS.length);
  }
}
