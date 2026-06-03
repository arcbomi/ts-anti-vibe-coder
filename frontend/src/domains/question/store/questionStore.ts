import { createStore } from 'zustand/vanilla'

import type { ExamQuestion, OptionKey } from '@/domains/question/types/question.types'

export interface QuestionState {
  questions: ExamQuestion[]
  selectedAnswers: Record<string, OptionKey>
  setQuestions: (questions: ExamQuestion[]) => void
  selectAnswer: (questionId: string, option: OptionKey) => void
  clearAnswers: () => void
}

export const questionStore = createStore<QuestionState>((set) => ({
  questions: [],
  selectedAnswers: {},
  setQuestions: (questions) => set({ questions }),
  selectAnswer: (questionId, option) =>
    set((state) => ({
      selectedAnswers: {
        ...state.selectedAnswers,
        [questionId]: option,
      },
    })),
  clearAnswers: () => set({ selectedAnswers: {} }),
}))
