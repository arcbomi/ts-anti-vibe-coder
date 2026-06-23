import { apiClient } from '@/shared/api/client'
import type {
  Exam,
  ExamResult,
  RawExam,
  RawExamQuestion,
  RawExamResult,
  RawSubmitExamResponse,
  SubmitExamResponse,
  SubmitExamRequest,
} from '@/domains/exam/types/exam.types'

function normalizeExamQuestion(question: RawExamQuestion): Exam['questions'][number] {
  const rawOptions = question.options
  const optionKeys = ['A', 'B', 'C', 'D'] as const
  const options = optionKeys.map((key, index) => {
    if (!Array.isArray(rawOptions)) {
      return { key, text: rawOptions[key] ?? '' }
    }

    const option = rawOptions.find((candidate) => candidate.key === key) ?? rawOptions[index]
    return { key, text: option?.text ?? '' }
  })

  return {
    id: question.id ?? question.question_id ?? '',
    question: question.question,
    options,
  }
}

function normalizeExam(exam: RawExam): Exam {
  return {
    id: exam.id ?? exam.exam_id ?? '',
    status: exam.status as Exam['status'],
    projectSlug: exam.projectSlug ?? exam.project_slug,
    projectName: exam.projectName ?? exam.project_name,
    scheduledAt: exam.scheduledAt ?? exam.scheduled_at,
    startedAt: exam.startedAt ?? exam.started_at,
    submittedAt: exam.submittedAt ?? exam.submitted_at,
    questions: exam.questions.map(normalizeExamQuestion),
  }
}

function normalizeExamResult(result: RawExamResult): ExamResult {
  return {
    examId: result.examId ?? result.exam_id ?? '',
    projectSlug: result.projectSlug ?? result.project_slug,
    score: result.score,
    totalQuestions: result.totalQuestions ?? result.total_questions ?? 0,
    correctCount: result.correctCount ?? result.correct_count ?? 0,
    passed: result.passed,
    passingScore: result.passingScore ?? result.passing_score ?? 0,
    status: result.status ?? (result.passed ? 'passed' : 'failed'),
  }
}

function normalizeSubmitExamResponse(response: RawSubmitExamResponse): SubmitExamResponse {
  return {
    examId: response.examId ?? response.exam_id ?? '',
    submitted: response.submitted,
  }
}

function toSubmitPayload(payload: SubmitExamRequest) {
  return {
    answers: payload.answers.map((answer) => ({
      question_id: answer.questionId,
      selected_option: answer.selectedOption,
    })),
  }
}

export function getExam(examId: string): Promise<Exam> {
  return apiClient.get<RawExam>(`/exams/${examId}`).then(normalizeExam)
}

export function submitExam(examId: string, payload: SubmitExamRequest): Promise<SubmitExamResponse> {
  return apiClient
    .post<RawSubmitExamResponse>(`/exams/${examId}/submit`, toSubmitPayload(payload))
    .then(normalizeSubmitExamResponse)
}

export function getExamResult(examId: string): Promise<ExamResult> {
  return apiClient.get<RawExamResult>(`/exams/${examId}/result`).then(normalizeExamResult)
}

export const examApi = {
  getExam,
  submitExam,
  getExamResult,
}
