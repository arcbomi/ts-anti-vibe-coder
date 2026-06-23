import { useSyncExternalStore } from 'react'
import { ApiError } from '@/shared/api/client'
import { repositoryApi } from '@/domains/repository/api/repositoryApi'
import { repositoryStore } from '@/domains/repository/store/repositoryStore'
import type { Repository } from '@/domains/repository/types/repository.types'

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

export function useRepositories() {
  const state = useSyncExternalStore(repositoryStore.subscribe, repositoryStore.getState)

  return {
    ...state,

    loadRepositories: async () => {
      repositoryStore.getState().setLoadingRepositories(true)
      repositoryStore.getState().setError(null)

      try {
        const repositories = await repositoryApi.list()
        repositoryStore.getState().setRepositories(repositories)
        return repositories
      } catch (error) {
        repositoryStore.getState().setError(errorMessage(error, 'Unable to load your repositories.'))
        return []
      } finally {
        repositoryStore.getState().setLoadingRepositories(false)
      }
    },

    selectRepository: (repository: Repository | null) => {
      repositoryStore.getState().setRepository(repository)
      repositoryStore.getState().setError(null)
      repositoryStore.getState().setAnalysisJobId(repository?.latestAnalysisJobId ?? null)
    },

    createRepository: async (giteaRepoUrl: string) => {
      repositoryStore.getState().setCreating(true)
      repositoryStore.getState().setError(null)
      repositoryStore.getState().setAnalysisJobId(null)

      try {
        const repository = await repositoryApi.create({ gitea_repo_url: giteaRepoUrl })
        repositoryStore.getState().setRepository(repository)
        const repositories = repositoryStore.getState().repositories
        const nextRepositories = [repository, ...repositories.filter((candidate) => candidate.id !== repository.id)]
        repositoryStore.getState().setRepositories(nextRepositories)
        return repository
      } catch (error) {
        repositoryStore
          .getState()
          .setError(errorMessage(error, 'Unable to connect this Gitea repository.'))
        return null
      } finally {
        repositoryStore.getState().setCreating(false)
      }
    },

    startAnalysis: async () => {
      const repository = repositoryStore.getState().repository
      if (!repository || repository.bot_access_status !== 'granted') return null

      repositoryStore.getState().setStartingAnalysis(true)
      repositoryStore.getState().setError(null)

      try {
        const response = await repositoryApi.startAnalysis(repository.id)
        repositoryStore.getState().setAnalysisJobId(response.analysis_job_id)
        const refreshedRepository = await repositoryApi.get(repository.id)
        repositoryStore.getState().setRepository(refreshedRepository)
        repositoryStore.getState().setRepositories(
          repositoryStore
            .getState()
            .repositories
            .map((candidate) => (candidate.id === refreshedRepository.id ? refreshedRepository : candidate)),
        )
        return response.analysis_job_id
      } catch (error) {
        repositoryStore.getState().setError(errorMessage(error, 'Unable to start AI analysis.'))
        return null
      } finally {
        repositoryStore.getState().setStartingAnalysis(false)
      }
    },
  }
}
