import { apiFetch } from '@/shared/api/client'
import type { AnalysisJob, StartAnalysisResponse } from '@/domains/analysis/types/analysis.types'

export function getAnalysisJob(jobId: string) {
  return apiFetch<AnalysisJob>(`/analysis-jobs/${jobId}`)
}

export function startAnalysis(repositoryId: string) {
  return apiFetch<StartAnalysisResponse>(`/repositories/${repositoryId}/start-analysis`, {
    method: 'POST',
  })
}

export const analysisApi = {
  getAnalysisJob,
  startAnalysis,
}
