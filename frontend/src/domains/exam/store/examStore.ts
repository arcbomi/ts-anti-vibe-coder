import { createStore } from 'zustand/vanilla'

type Answer = { questionId: string; selectedOption: 'A' | 'B' | 'C' | 'D' }

type State = {
  answers: Record<string, Answer>
  setAnswer: (questionId: string, opt: 'A' | 'B' | 'C' | 'D') => void
  reset: () => void
}

export const examStore = createStore<State>((set) => ({
  answers: {},
  setAnswer: (questionId, selectedOption) =>
    set((s) => ({
      answers: {
        ...s.answers,
        [questionId]: { questionId, selectedOption },
      },
    })),
  reset: () => set({ answers: {} }),
}))
