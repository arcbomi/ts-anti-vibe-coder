import { apiFetch } from '@/shared/api/client'
import type { Question } from '@/domains/question/types/question.types'

export const questionApi = {
  listForExam: (examId: string) => apiFetch<{ questions: Question[] }>(`/exams/${examId}`),
}
