export type AnalysisJobStatus =
  | 'pending'
  | 'checking_bot_access'
  | 'reading_repository'
  | 'indexing_code'
  | 'analyzing_code'
  | 'generating_questions'
  | 'saving_questions'
  | 'completed'
  | 'failed'

export interface AnalysisJob {
  id: string
  repositoryId: string
  status: AnalysisJobStatus
  progressMessage?: string
  errorMessage?: string
  createdAt: string
  completedAt?: string
}

export type StartAnalysisResponse = {
  analysis_job_id: string
}
