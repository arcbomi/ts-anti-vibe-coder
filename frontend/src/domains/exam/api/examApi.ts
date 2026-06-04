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
  const options = Array.isArray(rawOptions)
    ? rawOptions.reduce<Exam['questions'][number]['options']>((acc, option, index) => {
        const key = (option.key ?? (['A', 'B', 'C', 'D'] as const)[index]) as Exam['questions'][number]['options'][number]['key']
        acc.push({
          key,
          text: option.text ?? '',
        })
        return acc
      }, [])
    : (['A', 'B', 'C', 'D'] as const).map((key) => ({
        key,
        text: rawOptions[key] ?? '',
      }))

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
    scheduledAt: exam.scheduledAt ?? exam.scheduled_at,
    startedAt: exam.startedAt ?? exam.started_at,
    submittedAt: exam.submittedAt ?? exam.submitted_at,
    questions: exam.questions.map(normalizeExamQuestion),
  }
}

function normalizeExamResult(result: RawExamResult): ExamResult {
  return {
    examId: result.examId ?? result.exam_id ?? '',
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
