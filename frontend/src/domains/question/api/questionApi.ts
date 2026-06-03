import { apiClient } from '@/shared/api/client'
import type { ExamQuestion } from '@/domains/question/types/question.types'

export async function getExamQuestions(examId: string): Promise<ExamQuestion[]> {
  return apiClient.get<ExamQuestion[]>(`/exams/${examId}/questions`)
}

export async function getAnalysisJobQuestions(analysisJobId: string): Promise<ExamQuestion[]> {
  return apiClient.get<ExamQuestion[]>(`/analysis-jobs/${analysisJobId}/questions`)
}

export const questionApi = {
  getExamQuestions,
  getAnalysisJobQuestions,
  listForExam: async (examId: string) => ({ questions: await getExamQuestions(examId) }),
}
