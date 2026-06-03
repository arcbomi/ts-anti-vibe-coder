import { apiFetch } from '@/shared/api/client'
import type {
  CreateRepositoryRequest,
  Repository,
  StartAnalysisResponse,
} from '@/domains/repository/types/repository.types'

export const repositoryApi = {
  create: (request: CreateRepositoryRequest) =>
    apiFetch<Repository>('/repositories', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  get: (id: string) => apiFetch<Repository>(`/repositories/${id}`),

  checkBotAccess: (id: string) =>
    apiFetch<Repository>(`/repositories/${id}/check-bot-access`, {
      method: 'POST',
    }),

  startAnalysis: (id: string) =>
    apiFetch<StartAnalysisResponse>(`/repositories/${id}/start-analysis`, {
      method: 'POST',
    }),
}
