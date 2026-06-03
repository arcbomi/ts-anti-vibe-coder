import { createStore } from 'zustand/vanilla'

import type { Exam, ExamOptionKey, ExamResult } from '@/domains/exam/types/exam.types'

interface ExamState {
  exam: Exam | null
  selectedAnswers: Record<string, ExamOptionKey>
  result: ExamResult | null
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
}

interface ExamActions {
  setExam: (exam: Exam) => void
  selectAnswer: (questionId: string, option: ExamOptionKey) => void
  clearExam: () => void
  setResult: (result: ExamResult) => void
  setLoading: (isLoading: boolean) => void
  setSubmitting: (isSubmitting: boolean) => void
  setError: (error: string | null) => void
}

export type ExamStore = ExamState & ExamActions

const initialState: ExamState = {
  exam: null,
  selectedAnswers: {},
  result: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
}

export const examStore = createStore<ExamStore>((set) => ({
  ...initialState,

  setExam: (exam) => set({ exam, selectedAnswers: {}, result: null, error: null }),
  selectAnswer: (questionId, option) =>
    set((state) => ({ selectedAnswers: { ...state.selectedAnswers, [questionId]: option } })),
  clearExam: () => set(initialState),
  setResult: (result) => set({ result, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setError: (error) => set({ error }),
}))
