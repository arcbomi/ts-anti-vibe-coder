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

export type AnalysisJob = {
  id: string
  status: AnalysisJobStatus
}
