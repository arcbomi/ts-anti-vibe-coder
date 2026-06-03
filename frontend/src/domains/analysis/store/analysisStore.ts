import { createStore } from 'zustand/vanilla'

import type { AnalysisJob } from '@/domains/analysis/types/analysis.types'

interface AnalysisState {
  currentJob: AnalysisJob | null
  isLoading: boolean
  error: string | null
}

type AnalysisActions = {
  setCurrentJob: (job: AnalysisJob | null) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export type AnalysisStore = AnalysisState & AnalysisActions

const initialState: AnalysisState = {
  currentJob: null,
  isLoading: false,
  error: null,
}

export const analysisStore = createStore<AnalysisStore>((set) => ({
  ...initialState,

  setCurrentJob: (currentJob) => set({ currentJob }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}))
