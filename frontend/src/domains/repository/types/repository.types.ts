export type Repository = {
  id: string
  gitlabRepoUrl: string
  defaultBranch?: string
}

export type CreateRepositoryRequest = {
  gitlabRepoUrl: string
}

export type BotAccessStatus = 'unknown' | 'checking' | 'granted' | 'denied'
