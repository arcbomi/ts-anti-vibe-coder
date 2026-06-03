import { createStore } from 'zustand/vanilla'
import type { BotAccessStatus, Repository } from '@/domains/repository/types/repository.types'

type RepoState = {
  repository: Repository | null
  botAccess: BotAccessStatus
  setRepository: (repo: Repository | null) => void
  setBotAccess: (status: BotAccessStatus) => void
}

export const repositoryStore = createStore<RepoState>((set) => ({
  repository: null,
  botAccess: 'unknown',
  setRepository: (repository) => set({ repository }),
  setBotAccess: (botAccess) => set({ botAccess }),
}))
