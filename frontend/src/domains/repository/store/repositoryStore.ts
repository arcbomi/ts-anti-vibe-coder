import { createStore } from 'zustand/vanilla'
import type { BotAccessStatus, Repository } from '@/domains/repository/types/repository.types'

type RepositoryState = {
  repositories: Repository[]
  repository: Repository | null
  isLoadingRepositories: boolean
  isSyncingTomorrow: boolean
  isCreating: boolean
  isCheckingBotAccess: boolean
  isStartingAnalysis: boolean
  error: string | null
  analysisJobId: string | null
  syncMessage: string | null
}

type RepositoryActions = {
  setRepositories: (repositories: Repository[]) => void
  setRepository: (repository: Repository | null) => void
  setLoadingRepositories: (isLoadingRepositories: boolean) => void
  setSyncingTomorrow: (isSyncingTomorrow: boolean) => void
  setCreating: (isCreating: boolean) => void
  setCheckingBotAccess: (isCheckingBotAccess: boolean) => void
  setStartingAnalysis: (isStartingAnalysis: boolean) => void
  setError: (error: string | null) => void
  setAnalysisJobId: (analysisJobId: string | null) => void
  setSyncMessage: (syncMessage: string | null) => void
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
      repositories: Array.isArray(parsed.repositories) ? parsed.repositories : [],
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
      repositories: state.repositories,
      repository: state.repository,
      analysisJobId: state.analysisJobId,
    }),
  )
}

const initialState: RepositoryState = {
  repositories: [],
  repository: null,
  isLoadingRepositories: false,
  isSyncingTomorrow: false,
  isCreating: false,
  isCheckingBotAccess: false,
  isStartingAnalysis: false,
  error: null,
  analysisJobId: null,
  syncMessage: null,
}

export const repositoryStore = createStore<RepositoryStore>((set) => ({
  ...readStoredState(),

  setRepositories: (repositories) =>
    set((state) => {
      const selectedID = state.repository?.id
      const repository = selectedID ? repositories.find((candidate) => candidate.id === selectedID) ?? null : state.repository
      const nextState = { ...state, repositories, repository }
      writeStoredState(nextState)
      return { repositories, repository }
    }),
  setRepository: (repository) =>
    set((state) => {
      const nextState = { ...state, repository }
      writeStoredState(nextState)
      return { repository }
    }),
  setLoadingRepositories: (isLoadingRepositories) => set({ isLoadingRepositories }),
  setSyncingTomorrow: (isSyncingTomorrow) => set({ isSyncingTomorrow }),
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
  setSyncMessage: (syncMessage) => set({ syncMessage }),
  setBotAccessStatus: (botAccessStatus) =>
    set((state) => {
      const repository = state.repository ? { ...state.repository, bot_access_status: botAccessStatus } : null
      const repositories = repository
        ? state.repositories.map((candidate) => (candidate.id === repository.id ? repository : candidate))
        : state.repositories
      writeStoredState({ ...state, repositories, repository })
      return { repositories, repository }
    }),
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
