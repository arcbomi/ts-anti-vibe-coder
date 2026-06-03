import { apiFetch } from '@/shared/api/client'
import type { ExamResult } from '@/domains/exam/types/exam.types'

export const examApi = {
  submit: (examId: string, answers: Array<{ questionId: string; selectedOption: 'A' | 'B' | 'C' | 'D' }>) =>
    apiFetch<{ ok: boolean }>(`/exams/${examId}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
  result: (examId: string) => apiFetch<ExamResult>(`/exams/${examId}/result`),
}
