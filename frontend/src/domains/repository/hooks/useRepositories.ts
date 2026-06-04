import { useSyncExternalStore } from 'react'
import { ApiError } from '@/shared/api/client'
import { repositoryApi } from '@/domains/repository/api/repositoryApi'
import { repositoryStore } from '@/domains/repository/store/repositoryStore'

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

export function useRepositories() {
  const state = useSyncExternalStore(repositoryStore.subscribe, repositoryStore.getState)

  return {
    ...state,

    createRepository: async (gitlabRepoUrl: string) => {
      repositoryStore.getState().setCreating(true)
      repositoryStore.getState().setError(null)
      repositoryStore.getState().setAnalysisJobId(null)

      try {
        const repository = await repositoryApi.create({ gitlab_repo_url: gitlabRepoUrl })
        repositoryStore.getState().setRepository(repository)
        return repository
      } catch (error) {
        repositoryStore
          .getState()
          .setError(errorMessage(error, 'Unable to connect this GitLab repository.'))
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
