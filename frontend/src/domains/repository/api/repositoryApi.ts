import { apiFetch } from '@/shared/api/client'
import type {
  CreateRepositoryRequest,
  Repository,
  StartAnalysisResponse,
} from '@/domains/repository/types/repository.types'

type RawRepository = {
  id?: string
  repository_id?: string
  gitea_repo_url: string
  bot_access_status: Repository['bot_access_status']
  latest_analysis_job_id?: string | null
  latestAnalysisJobId?: string | null
  latest_analysis_status?: string | null
  latestAnalysisStatus?: string | null
  latest_analysis_error_message?: string | null
  latestAnalysisErrorMessage?: string | null
}

function normalizeRepository(repository: RawRepository): Repository {
  return {
    id: repository.id ?? repository.repository_id ?? '',
    gitea_repo_url: repository.gitea_repo_url,
    bot_access_status: repository.bot_access_status,
    latestAnalysisJobId: repository.latestAnalysisJobId ?? repository.latest_analysis_job_id ?? null,
    latestAnalysisStatus: repository.latestAnalysisStatus ?? repository.latest_analysis_status ?? null,
    latestAnalysisErrorMessage: repository.latestAnalysisErrorMessage ?? repository.latest_analysis_error_message ?? null,
  }
}

export const repositoryApi = {
  list: async () => (await apiFetch<RawRepository[]>('/repositories')).map(normalizeRepository),

  create: async (request: CreateRepositoryRequest) => {
    const repository = await apiFetch<RawRepository>('/repositories', {
      method: 'POST',
      body: JSON.stringify(request),
    })

    return normalizeRepository(repository)
  },

  get: async (id: string) => normalizeRepository(await apiFetch<RawRepository>(`/repositories/${id}`)),

  checkBotAccess: async (id: string) =>
    normalizeRepository(
      await apiFetch<RawRepository>(`/repositories/${id}/check-bot-access`, {
        method: 'POST',
      }),
    ),

  startAnalysis: (id: string) =>
    apiFetch<StartAnalysisResponse>(`/repositories/${id}/start-analysis`, {
      method: 'POST',
    }),
}
