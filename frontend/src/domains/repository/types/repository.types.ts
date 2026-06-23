export type BotAccessStatus = 'unknown' | 'checking' | 'granted' | 'denied' | 'failed'

export type Repository = {
  id: string
  gitea_repo_url: string
  gitea_project_path?: string
  tomorrow_audit_text?: string
  bot_access_status: BotAccessStatus
  latestAnalysisJobId?: string | null
  latestAnalysisStatus?: string | null
  latestAnalysisErrorMessage?: string | null
}

export type CreateRepositoryRequest = {
  gitea_repo_url: string
}

export type StartAnalysisResponse = {
  analysis_job_id: string
}
