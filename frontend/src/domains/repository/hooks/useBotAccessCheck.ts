import { ApiError } from '@/shared/api/client'
import { repositoryApi } from '@/domains/repository/api/repositoryApi'
import { repositoryStore } from '@/domains/repository/store/repositoryStore'

function botAccessErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  return 'Bot access denied. Please make sure you added the correct Gitea userbot as a collaborator.'
}

export function useBotAccessCheck() {
  return {
    checkBotAccess: async () => {
      const repository = repositoryStore.getState().repository
      if (!repository) return

      repositoryStore.getState().setCheckingBotAccess(true)
      repositoryStore.getState().setError(null)
      repositoryStore.getState().setBotAccessStatus('checking')

      try {
        const checkedRepository = await repositoryApi.checkBotAccess(repository.id)
        repositoryStore.getState().setRepository(checkedRepository)
        repositoryStore.getState().setRepositories(
          repositoryStore
            .getState()
            .repositories
            .map((candidate) => (candidate.id === checkedRepository.id ? checkedRepository : candidate)),
        )
      } catch (error) {
        repositoryStore.getState().setBotAccessStatus('failed')
        repositoryStore.getState().setError(botAccessErrorMessage(error))
      } finally {
        repositoryStore.getState().setCheckingBotAccess(false)
      }
    },
  }
}
