import { ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

import { getAnalysisJobQuestions, getExamQuestions } from '@/domains/question/api/questionApi'
import type { ExamQuestion } from '@/domains/question/types/question.types'

interface UseQuestionsOptions {
  analysisJobId?: MaybeRefOrGetter<string | undefined>
}

interface UseQuestionsResult {
  questions: Ref<ExamQuestion[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
}

export function useQuestions(
  examId?: MaybeRefOrGetter<string | undefined>,
  options: UseQuestionsOptions = {},
): UseQuestionsResult {
  const { analysisJobId } = options
  const questions = ref<ExamQuestion[]>([])
  const loading = ref(Boolean(toValue(examId) || toValue(analysisJobId)))
  const error = ref<string | null>(null)

  const refetch = async () => {
    const currentExamId = toValue(examId)
    const currentAnalysisJobId = toValue(analysisJobId)

    if (!currentExamId && !currentAnalysisJobId) {
      questions.value = []
      loading.value = false
      error.value = null
      return
    }

    loading.value = true
    error.value = null

    try {
      questions.value = currentExamId
        ? await getExamQuestions(currentExamId)
        : await getAnalysisJobQuestions(currentAnalysisJobId as string)
    } catch (caughtError: unknown) {
      error.value = caughtError instanceof Error ? caughtError.message : 'Failed to load questions.'
      questions.value = []
    } finally {
      loading.value = false
    }
  }

  watch(
    [() => toValue(examId), () => toValue(analysisJobId)],
    () => {
      queueMicrotask(() => {
        void refetch()
      })
    },
    { immediate: true },
  )

  return { questions, loading, error, refetch }
}
