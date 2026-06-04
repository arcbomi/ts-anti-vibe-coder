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
  clearRepository: () => void
  reset: () => void
}

export type RepositoryStore = RepositoryState & RepositoryActions

const REPOSITORY_STORAGE_KEY = 'repository_flow_state'

function readStoredState(): RepositoryState {
  if (typeof window === 'undefined') return initialState

  const rawState = sessionStorage.getItem(REPOSITORY_STORAGE_KEY)
  if (!rawState) return initialState

  try {
    const parsed = JSON.parse(rawState) as Partial<RepositoryState>

    return {
      ...initialState,
      repository: parsed.repository ?? null,
      analysisJobId: parsed.analysisJobId ?? null,
    }
  } catch {
    return initialState
  }
}

function writeStoredState(state: RepositoryState) {
  if (typeof window === 'undefined') return

  sessionStorage.setItem(
    REPOSITORY_STORAGE_KEY,
    JSON.stringify({
      repository: state.repository,
      analysisJobId: state.analysisJobId,
    }),
  )
}

const initialState: RepositoryState = {
  repository: null,
  isCreating: false,
  isCheckingBotAccess: false,
  isStartingAnalysis: false,
  error: null,
  analysisJobId: null,
}

export const repositoryStore = createStore<RepositoryStore>((set) => ({
  ...readStoredState(),

  setRepository: (repository) =>
    set((state) => {
      const nextState = { ...state, repository }
      writeStoredState(nextState)
      return { repository }
    }),
  setCreating: (isCreating) => set({ isCreating }),
  setCheckingBotAccess: (isCheckingBotAccess) => set({ isCheckingBotAccess }),
  setStartingAnalysis: (isStartingAnalysis) => set({ isStartingAnalysis }),
  setError: (error) => set({ error }),
  setAnalysisJobId: (analysisJobId) =>
    set((state) => {
      const nextState = { ...state, analysisJobId }
      writeStoredState(nextState)
      return { analysisJobId }
    }),
  setBotAccessStatus: (botAccessStatus) =>
    set((state) => ({
      repository: (() => {
        const repository = state.repository ? { ...state.repository, bot_access_status: botAccessStatus } : null
        writeStoredState({ ...state, repository })
        return repository
      })(),
    })),
  clearRepository: () =>
    set(() => {
      writeStoredState(initialState)
      return initialState
    }),
  reset: () =>
    set(() => {
      writeStoredState(initialState)
      return initialState
    }),
}))
