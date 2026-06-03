import { createStore } from 'zustand/vanilla'
import type { AnalysisJob } from '@/domains/analysis/types/analysis.types'

type State = {
  job: AnalysisJob | null
  setJob: (job: AnalysisJob | null) => void
}

export const analysisStore = createStore<State>((set) => ({
  job: null,
  setJob: (job) => set({ job }),
}))
