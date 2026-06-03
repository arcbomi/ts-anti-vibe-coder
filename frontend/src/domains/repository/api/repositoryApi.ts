import { apiFetch } from '@/shared/api/client'
import type { CreateRepositoryRequest, Repository } from '@/domains/repository/types/repository.types'

export const repositoryApi = {
  create: (req: CreateRepositoryRequest) =>
    apiFetch<Repository>('/repositories', { method: 'POST', body: JSON.stringify(req) }),
  checkBotAccess: (id: string) => apiFetch<{ ok: boolean }>(`/repositories/${id}/check-bot-access`, { method: 'POST' }),
  startAnalysis: (id: string) => apiFetch<{ jobId: string }>(`/repositories/${id}/start-analysis`, { method: 'POST' }),
}
