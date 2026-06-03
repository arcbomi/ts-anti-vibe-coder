import { useCallback, useEffect, useState } from 'react'

import { getAnalysisJobQuestions, getExamQuestions } from '@/domains/question/api/questionApi'
import type { ExamQuestion } from '@/domains/question/types/question.types'

interface UseQuestionsOptions {
  analysisJobId?: string
}

interface UseQuestionsResult {
  questions: ExamQuestion[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useQuestions(examId?: string, options: UseQuestionsOptions = {}): UseQuestionsResult {
  const { analysisJobId } = options
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [loading, setLoading] = useState(Boolean(examId || analysisJobId))
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    await Promise.resolve()

    if (!examId && !analysisJobId) {
      setQuestions([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const loadedQuestions = examId ? await getExamQuestions(examId) : await getAnalysisJobQuestions(analysisJobId as string)
      setQuestions(loadedQuestions)
    } catch (caughtError: unknown) {
      const message = caughtError instanceof Error ? caughtError.message : 'Failed to load questions.'
      setError(message)
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }, [analysisJobId, examId])

  useEffect(() => {
    queueMicrotask(() => {
      void refetch()
    })
  }, [refetch])

  return { questions, loading, error, refetch }
}
