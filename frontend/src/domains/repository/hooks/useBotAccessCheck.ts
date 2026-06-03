import { repositoryApi } from '@/domains/repository/api/repositoryApi'
import { repositoryStore } from '@/domains/repository/store/repositoryStore'

export function useBotAccessCheck() {
  return {
    check: async () => {
      const repo = repositoryStore.getState().repository
      if (!repo) return
      repositoryStore.getState().setBotAccess('checking')
      try {
        const res = await repositoryApi.checkBotAccess(repo.id)
        repositoryStore.getState().setBotAccess(res.ok ? 'granted' : 'denied')
      } catch {
        repositoryStore.getState().setBotAccess('denied')
      }
    },
  }
}
