import { apiClient } from '@/shared/api/client'
import type { Exam, ExamResult, SubmitExamRequest } from '@/domains/exam/types/exam.types'

export function getExam(examId: string): Promise<Exam> {
  return apiClient.get<Exam>(`/exams/${examId}`)
}

export function submitExam(examId: string, payload: SubmitExamRequest): Promise<ExamResult> {
  return apiClient.post<ExamResult>(`/exams/${examId}/submit`, payload)
}

export function getExamResult(examId: string): Promise<ExamResult> {
  return apiClient.get<ExamResult>(`/exams/${examId}/result`)
}

export const examApi = {
  getExam,
  submitExam,
  getExamResult,
}
