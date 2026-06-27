import { randomUUID } from "node:crypto";
import { AppError } from "@backend/microservice-sdk";
import type {
  CreateExamRequest,
  CreateExamResponse,
  ExamResponse,
  PrepareSucceededProjectRequest,
  PrepareSucceededProjectResponse,
  PublicExamQuestion,
  ResultResponse,
  StartSucceededProjectPreparationResponse,
  StoredExamAnswer,
  SubmitExamRequest,
  SucceededProject,
  SucceededProjectsResponse
} from "../models/exam.js";
import { QUESTION_COUNT } from "../models/question.js";
import { ExamRepository } from "../repositories/examRepository.js";
import { QuestionRepository } from "../repositories/questionRepository.js";
import { toMappedPublicQuestion } from "../utils/questionMapper.js";
import { buildProjectState, sanitizeProjectSlug } from "../utils/projectState.js";
import { validateCreateExamRequest, validatePrepareSucceededProjectRequest, validateSubmitExamRequest } from "../validation/examValidation.js";

export class ExamService {
  examRepository: ExamRepository;
  questionRepository: QuestionRepository;
  passingScore: number;
  examOpenDay: string;

  constructor({
    examRepository,
    questionRepository,
    passingScore,
    examOpenDay
  }: {
    examRepository: ExamRepository;
    questionRepository: QuestionRepository;
    passingScore: number;
    examOpenDay: string;
  }) {
    this.examRepository = examRepository;
    this.questionRepository = questionRepository;
    this.passingScore = passingScore;
    this.examOpenDay = examOpenDay;
  }

  createExam(userId: string, payload: CreateExamRequest): CreateExamResponse {
    const validated = validateCreateExamRequest(userId, payload);
    const analysisJob = this.examRepository.ensureAnalysisOwnership(
      userId,
      validated.analysis_job_id,
      validated.repository_id
    );
    const questions = this.questionRepository.getQuestionsByAnalysisJob(userId, analysisJob.analysisJobId);

    if (questions.length < QUESTION_COUNT) {
      throw new AppError("This analysis job does not have 20 generated questions.", {
        statusCode: 409,
        code: "NOT_ENOUGH_QUESTIONS"
      });
    }

    const scheduledAt = validated.scheduled_at || this.nextScheduledExamDate();
    const exam = this.examRepository.createExam({
      userId,
      analysisJob,
      questionIds: questions.slice(0, QUESTION_COUNT).map((question) => question.id),
      scheduledAt,
      passingScore: this.passingScore
    });

    return {
      id: exam.id,
      exam_id: exam.id,
      analysis_job_id: exam.analysisJobId,
      status: exam.status,
      question_count: QUESTION_COUNT
    };
  }

  getExam(userId: string, examId: string): ExamResponse {
    const exam = this.examRepository.getExam(userId, examId);
    const questions = this.questionRepository.getQuestionsByExam(userId, examId);
    const mappings = this.questionRepository.getExamOptionMappings(examId).length
      ? this.questionRepository.getExamOptionMappings(examId)
      : this.questionRepository.buildOptionMappings(examId, questions);
    const publicQuestions: PublicExamQuestion[] = questions.map((question, index) => ({
      id: question.id,
      question_id: question.id,
      index: index + 1,
      question: question.question,
      options: toMappedPublicQuestion(
        question,
        mappings.filter((mapping) => mapping.questionId === question.id)
      ).options,
      difficulty: question.difficulty,
      source_file_path: question.sourceFilePath
    }));

    return {
      id: exam.id,
      exam_id: exam.id,
      attempt_id: exam.id,
      project_slug: exam.projectSlug,
      user_id: exam.userId,
      repository_id: exam.repositoryId,
      analysis_job_id: exam.analysisJobId,
      scheduled_at: exam.scheduledAt,
      status: exam.status,
      ...(exam.score !== null ? { score: exam.score } : {}),
      ...(exam.passed !== null ? { passed: exam.passed } : {}),
      ...(exam.submittedAt ? { submitted_at: exam.submittedAt } : {}),
      questions: publicQuestions
    };
  }

  submitExam(userId: string, examId: string, payload: SubmitExamRequest): ResultResponse {
    const exam = this.examRepository.getExam(userId, examId);
    validateSubmitExamRequest(payload);

    if (exam.submittedAt || exam.status === "submitted" || exam.status === "passed" || exam.status === "failed") {
      throw new AppError("This exam has already been submitted.", {
        statusCode: 409,
        code: "EXAM_ALREADY_SUBMITTED"
      });
    }

    const questions = this.questionRepository.getQuestionsByExam(userId, examId);
    if (questions.length !== QUESTION_COUNT) {
      throw new AppError("Exam does not have exactly 20 assigned questions.", {
        statusCode: 409,
        code: "NOT_ENOUGH_QUESTIONS"
      });
    }

    const questionById = new Map(questions.map((question) => [question.id, question]));
    const answers: StoredExamAnswer[] = [];
    let correctCount = 0;

    for (const answer of payload.answers) {
      const question = questionById.get(answer.question_id);
      if (!question) {
        throw new AppError("Submitted question_id does not belong to this exam.", {
          statusCode: 400,
          code: "QUESTION_NOT_IN_EXAM"
        });
      }

      const selectedOption = answer.selected_option.trim().toUpperCase() as StoredExamAnswer["selectedOption"];
      const isCorrect = selectedOption === question.correctOption;
      if (isCorrect) {
        correctCount += 1;
      }

      answers.push({
        id: randomUUID(),
        examId,
        questionId: question.id,
        selectedOption,
        isCorrect,
        correctOption: question.correctOption,
        explanation: question.explanation,
        createdAt: new Date().toISOString()
      });
    }

    const passed = correctCount >= exam.passingScore;
    const updatedExam = this.examRepository.saveSubmission(examId, answers, correctCount, passed);

    return {
      id: updatedExam.id,
      exam_id: updatedExam.id,
      attempt_id: updatedExam.id,
      project_slug: updatedExam.projectSlug,
      submitted: true,
      total: QUESTION_COUNT,
      total_questions: QUESTION_COUNT,
      correct_count: correctCount,
      score: correctCount,
      passed,
      passing_score: updatedExam.passingScore,
      status: updatedExam.status
    };
  }

  getResult(userId: string, examId: string): ResultResponse {
    const exam = this.examRepository.getExam(userId, examId);
    const answers = this.examRepository.getResultAnswers(examId);
    if (!exam.submittedAt || exam.score === null || exam.passed === null || answers.length === 0) {
      throw new AppError("Exam has not been submitted yet.", {
        statusCode: 400,
        code: "BAD_REQUEST"
      });
    }

    return {
      id: exam.id,
      exam_id: exam.id,
      attempt_id: exam.id,
      project_slug: exam.projectSlug,
      total: QUESTION_COUNT,
      total_questions: QUESTION_COUNT,
      correct_count: answers.filter((answer) => answer.isCorrect).length,
      score: exam.score,
      passed: exam.passed,
      passing_score: exam.passingScore,
      status: exam.status,
      answers: answers.map((answer) => ({
        question_id: answer.questionId,
        selected_option: answer.selectedOption,
        is_correct: answer.isCorrect,
        correct_option: answer.correctOption,
        explanation: answer.explanation
      }))
    };
  }

  listSucceededProjects(userId: string): SucceededProjectsResponse {
    const projects = this.examRepository.listSucceededProjects(userId);
    const jobs = this.examRepository.listPreparationJobs(userId);
    const exams = this.examRepository.listUserExams(userId);

    const items: SucceededProject[] = projects.map((project) =>
      buildProjectState({
        project,
        jobs,
        exam: exams.find((exam) => exam.projectSlug === project.projectSlug)
      })
    );

    return {
      projects: items.sort((left, right) => left.project_name.localeCompare(right.project_name))
    };
  }

  prepareSucceededProject(payload: PrepareSucceededProjectRequest): PrepareSucceededProjectResponse {
    const validated = validatePrepareSucceededProjectRequest(payload);
    const job = this.examRepository.createPreparationJob({
      userId: validated.user_id,
      projectSlug: sanitizeProjectSlug(validated.project_slug),
      repoUrl: validated.repo_url,
      attemptId: validated.attempt_id
    });

    this.examRepository.updatePreparationToDownloading(job.id);
    const completedJob = this.examRepository.completePreparationJob(job.id);
    const project = this.examRepository
      .listSucceededProjects(validated.user_id)
      .find((item) => item.projectSlug === sanitizeProjectSlug(validated.project_slug));

    if (project) {
      const analysisJob = this.examRepository.createAnalysisJobFromPreparation(project, validated.user_id);
      this.examRepository.seedGeneratedQuestions(analysisJob.analysisJobId);
    }

    return {
      job_id: completedJob.id,
      attempt_id: completedJob.attemptId,
      status: completedJob.status,
      project_slug: completedJob.projectSlug
    };
  }

  startSucceededProjectPreparation(userId: string, projectSlug: string): StartSucceededProjectPreparationResponse {
    const project = this.examRepository
      .listSucceededProjects(userId)
      .find((item) => item.projectSlug === sanitizeProjectSlug(projectSlug));

    if (!project) {
      throw new AppError("Succeeded project not found.", {
        statusCode: 404,
        code: "EXAM_NOT_FOUND"
      });
    }

    const response = this.prepareSucceededProject({
      user_id: userId,
      project_slug: project.projectSlug,
      repo_url: project.repoUrl,
      attempt_id: randomUUID()
    });

    return {
      project_slug: response.project_slug,
      preparation_status: "preparing",
      attempt_id: response.attempt_id
    };
  }

  private nextScheduledExamDate() {
    const current = new Date();
    const targetDay = weekdays.indexOf(this.examOpenDay.toLowerCase());
    const candidate = new Date(current);
    while (candidate.getUTCDay() !== (targetDay === -1 ? 5 : targetDay)) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    }
    return candidate.toISOString();
  }
}

const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
