export type BotAccessStatus = 'unknown' | 'checking' | 'granted' | 'denied' | 'failed'

export type Repository = {
  id: string
  gitlab_repo_url: string
  bot_access_status: BotAccessStatus
  latestAnalysisJobId?: string | null
}

export type CreateRepositoryRequest = {
  gitlab_repo_url: string
}

export type StartAnalysisResponse = {
  analysis_job_id: string
}
