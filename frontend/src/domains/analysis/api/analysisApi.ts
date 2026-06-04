import { apiFetch } from '@/shared/api/client'
import type { AnalysisJob, RawAnalysisJob, StartAnalysisResponse } from '@/domains/analysis/types/analysis.types'

function normalizeAnalysisJob(job: RawAnalysisJob): AnalysisJob {
  return {
    id: job.id ?? job.analysis_job_id ?? '',
    repositoryId: job.repositoryId ?? job.repository_id ?? '',
    status: job.status,
    progressMessage: job.progressMessage ?? job.progress_message,
    errorMessage: job.errorMessage ?? job.error_message,
    createdAt: job.createdAt ?? job.created_at ?? '',
    completedAt: job.completedAt ?? job.completed_at,
  }
}

export async function getAnalysisJob(jobId: string) {
  return normalizeAnalysisJob(await apiFetch<RawAnalysisJob>(`/analysis-jobs/${jobId}`))
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
