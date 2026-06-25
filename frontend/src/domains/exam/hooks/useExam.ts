import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { getExam, getExamResult, submitExam as submitExamRequest } from '@/domains/exam/api/examApi'
import { examStore } from '@/domains/exam/store/examStore'
import type { ExamOptionKey } from '@/domains/exam/types/exam.types'
import { ApiError } from '@/shared/api/client'
import { useVanillaStore } from '@/shared/state/useVanillaStore'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback
}

export function useExam(examId?: MaybeRefOrGetter<string | undefined>) {
  const state = useVanillaStore(examStore)

  const loadExam = async () => {
    const currentExamId = toValue(examId)

    if (!currentExamId) {
      examStore.getState().setError('Missing exam id.')
      return null
    }

    examStore.getState().setLoading(true)
    examStore.getState().setError(null)

    try {
      const exam = await getExam(currentExamId)
      examStore.getState().setExam(exam)
      return exam
    } catch (error) {
      examStore.getState().setError(getErrorMessage(error, 'Failed to load exam.'))
      return null
    } finally {
      examStore.getState().setLoading(false)
    }
  }

  const selectAnswer = (questionId: string, option: ExamOptionKey) => {
    const { exam, isSubmitting, selectAnswer: storeSelectAnswer } = examStore.getState()
    if (!exam || isSubmitting || ['submitted', 'passed', 'failed'].includes(exam.status)) return

    storeSelectAnswer(questionId, option)
  }

  const submitExam = async () => {
    const currentExamId = toValue(examId)

    if (!currentExamId) {
      examStore.getState().setError('Missing exam id.')
      return null
    }

    const state = examStore.getState()
    if (state.isSubmitting || !state.exam || ['submitted', 'passed', 'failed'].includes(state.exam.status)) {
      return null
    }

    const answers = state.exam.questions.map((question: (typeof state.exam.questions)[number]) => {
      const selectedOption = state.selectedAnswers[question.id]
      return selectedOption ? { questionId: question.id, selectedOption } : null
    })

    if (state.exam.questions.length !== 20 || answers.some((answer: (typeof answers)[number]) => answer === null)) {
      state.setError('Answer all 20 questions before submitting.')
      return null
    }

    state.setSubmitting(true)
    state.setError(null)

    try {
      const response = await submitExamRequest(currentExamId, {
        answers: answers.filter((answer: (typeof answers)[number]) => answer !== null),
      })
      if (response.submitted) {
        examStore.getState().markSubmitted()
      }
      return response
    } catch (error) {
      examStore.getState().setError(getErrorMessage(error, 'Failed to submit exam.'))
      return null
    } finally {
      examStore.getState().setSubmitting(false)
    }
  }

  const loadResult = async () => {
    const currentExamId = toValue(examId)

    if (!currentExamId) {
      examStore.getState().setError('Missing exam id.')
      return null
    }

    examStore.getState().setLoading(true)
    examStore.getState().setError(null)

    try {
      const result = await getExamResult(currentExamId)
      examStore.getState().setResult(result)
      return result
    } catch (error) {
      examStore.getState().setError(getErrorMessage(error, 'Failed to load exam result.'))
      return null
    } finally {
      examStore.getState().setLoading(false)
    }
  }

  return {
    exam: computed(() => state.value.exam),
    selectedAnswers: computed(() => state.value.selectedAnswers),
    result: computed(() => state.value.result),
    isLoading: computed(() => state.value.isLoading),
    isSubmitting: computed(() => state.value.isSubmitting),
    error: computed(() => state.value.error),
    loadExam,
    selectAnswer,
    submitExam,
    loadResult,
  }
}
