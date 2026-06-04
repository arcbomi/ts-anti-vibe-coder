import { useCallback, useSyncExternalStore } from 'react'

import { getExam, getExamResult, submitExam as submitExamRequest } from '@/domains/exam/api/examApi'
import { examStore } from '@/domains/exam/store/examStore'
import type { ExamOptionKey } from '@/domains/exam/types/exam.types'
import { ApiError } from '@/shared/api/client'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback
}

export function useExam(examId?: string) {
  const state = useSyncExternalStore(examStore.subscribe, examStore.getState)

  const loadExam = useCallback(async () => {
    if (!examId) {
      examStore.getState().setError('Missing exam id.')
      return null
    }

    examStore.getState().setLoading(true)
    examStore.getState().setError(null)

    try {
      const exam = await getExam(examId)
      examStore.getState().setExam(exam)
      return exam
    } catch (error) {
      examStore.getState().setError(getErrorMessage(error, 'Failed to load exam.'))
      return null
    } finally {
      examStore.getState().setLoading(false)
    }
  }, [examId])

  const selectAnswer = useCallback((questionId: string, option: ExamOptionKey) => {
    examStore.getState().selectAnswer(questionId, option)
  }, [])

  const submitExam = useCallback(async () => {
    if (!examId) {
      examStore.getState().setError('Missing exam id.')
      return null
    }

    examStore.getState().setSubmitting(true)
    examStore.getState().setError(null)

    try {
      const answers = Object.entries(examStore.getState().selectedAnswers).map(([questionId, selectedOption]) => ({
        questionId,
        selectedOption,
      }))
      return await submitExamRequest(examId, { answers })
    } catch (error) {
      examStore.getState().setError(getErrorMessage(error, 'Failed to submit exam.'))
      return null
    } finally {
      examStore.getState().setSubmitting(false)
    }
  }, [examId])

  const loadResult = useCallback(async () => {
    if (!examId) {
      examStore.getState().setError('Missing exam id.')
      return null
    }

    examStore.getState().setLoading(true)
    examStore.getState().setError(null)

    try {
      const result = await getExamResult(examId)
      examStore.getState().setResult(result)
      return result
    } catch (error) {
      examStore.getState().setError(getErrorMessage(error, 'Failed to load exam result.'))
      return null
    } finally {
      examStore.getState().setLoading(false)
    }
  }, [examId])

  return {
    exam: state.exam,
    selectedAnswers: state.selectedAnswers,
    result: state.result,
    isLoading: state.isLoading,
    isSubmitting: state.isSubmitting,
    error: state.error,
    loadExam,
    selectAnswer,
    submitExam,
    loadResult,
  }
}
