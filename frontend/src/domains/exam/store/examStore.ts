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
  markSubmitted: () => void
  clearExam: () => void
  setResult: (result: ExamResult) => void
  setLoading: (isLoading: boolean) => void
  setSubmitting: (isSubmitting: boolean) => void
  setError: (error: string | null) => void
}

export type ExamStore = ExamState & ExamActions

const EXAM_ANSWER_DRAFTS_KEY = 'exam_answer_drafts'

function readDrafts(): Record<string, Record<string, ExamOptionKey>> {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(EXAM_ANSWER_DRAFTS_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw) as Record<string, Record<string, ExamOptionKey>>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeDrafts(drafts: Record<string, Record<string, ExamOptionKey>>) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(EXAM_ANSWER_DRAFTS_KEY, JSON.stringify(drafts))
}

function readDraftForExam(examId: string) {
  return readDrafts()[examId] ?? {}
}

function writeDraftForExam(examId: string, selectedAnswers: Record<string, ExamOptionKey>) {
  const drafts = readDrafts()
  drafts[examId] = selectedAnswers
  writeDrafts(drafts)
}

function clearDraftForExam(examId?: string) {
  if (!examId) return

  const drafts = readDrafts()
  delete drafts[examId]
  writeDrafts(drafts)
}

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

  setExam: (exam) =>
    set({
      exam,
      selectedAnswers: readDraftForExam(exam.id),
      result: null,
      error: null,
    }),
  selectAnswer: (questionId, option) =>
    set((state) => {
      const selectedAnswers = { ...state.selectedAnswers, [questionId]: option }
      if (state.exam?.id) {
        writeDraftForExam(state.exam.id, selectedAnswers)
      }
      return { selectedAnswers }
    }),
  markSubmitted: () =>
    set((state) => {
      clearDraftForExam(state.exam?.id)
      return {
        exam: state.exam ? { ...state.exam, status: 'submitted' } : null,
        selectedAnswers: {},
      }
    }),
  clearExam: () => set(initialState),
  setResult: (result) =>
    set((state) => {
      clearDraftForExam(result.examId || state.exam?.id)
      return { result, error: null }
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setError: (error) => set({ error }),
}))
