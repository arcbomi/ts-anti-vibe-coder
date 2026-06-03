import { createStore } from 'zustand/vanilla'
import type { BotAccessStatus, Repository } from '@/domains/repository/types/repository.types'

type RepositoryState = {
  repository: Repository | null
  isCreating: boolean
  isCheckingBotAccess: boolean
  isStartingAnalysis: boolean
  error: string | null
  analysisJobId: string | null
}

type RepositoryActions = {
  setRepository: (repository: Repository | null) => void
  setCreating: (isCreating: boolean) => void
  setCheckingBotAccess: (isCheckingBotAccess: boolean) => void
  setStartingAnalysis: (isStartingAnalysis: boolean) => void
  setError: (error: string | null) => void
  setAnalysisJobId: (analysisJobId: string | null) => void
  setBotAccessStatus: (status: BotAccessStatus) => void
  reset: () => void
}

export type RepositoryStore = RepositoryState & RepositoryActions

const initialState: RepositoryState = {
  repository: null,
  isCreating: false,
  isCheckingBotAccess: false,
  isStartingAnalysis: false,
  error: null,
  analysisJobId: null,
}

export const repositoryStore = createStore<RepositoryStore>((set) => ({
  ...initialState,

  setRepository: (repository) => set({ repository }),
  setCreating: (isCreating) => set({ isCreating }),
  setCheckingBotAccess: (isCheckingBotAccess) => set({ isCheckingBotAccess }),
  setStartingAnalysis: (isStartingAnalysis) => set({ isStartingAnalysis }),
  setError: (error) => set({ error }),
  setAnalysisJobId: (analysisJobId) => set({ analysisJobId }),
  setBotAccessStatus: (botAccessStatus) =>
    set((state) => ({
      repository: state.repository ? { ...state.repository, bot_access_status: botAccessStatus } : null,
    })),
  reset: () => set(initialState),
}))
