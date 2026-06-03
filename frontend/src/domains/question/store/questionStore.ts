import { createStore } from 'zustand/vanilla'
import type { Question } from '@/domains/question/types/question.types'

type State = {
  questions: Question[]
  setQuestions: (q: Question[]) => void
}

export const questionStore = createStore<State>((set) => ({
  questions: [],
  setQuestions: (questions) => set({ questions }),
}))
