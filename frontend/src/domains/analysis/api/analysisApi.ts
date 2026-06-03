import { apiFetch } from '@/shared/api/client'
import type { AnalysisJob } from '@/domains/analysis/types/analysis.types'

export const analysisApi = {
  getJob: (id: string) => apiFetch<AnalysisJob>(`/analysis-jobs/${id}`),
  getQuestions: (id: string) => apiFetch<{ examId?: string }>(`/analysis-jobs/${id}/questions`),
}
