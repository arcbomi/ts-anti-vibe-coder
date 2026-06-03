import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { examApi } from '@/domains/exam/api/examApi'
import type { ExamResult } from '@/domains/exam/types/exam.types'
import { LoadingState } from '@/shared/components/LoadingState'
import { ErrorState } from '@/shared/components/ErrorState'

export function ExamResultSection() {
  const { examId } = useParams()
  const [result, setResult] = useState<ExamResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!examId) return
    let stopped = false
    const run = async () => {
      try {
        const r = await examApi.result(examId)
        if (!stopped) setResult(r)
      } catch (caughtError: unknown) {
        const message = caughtError instanceof Error ? caughtError.message : 'Failed to load result'
        if (!stopped) setError(message)
      }
    }
    void run()
    return () => {
      stopped = true
    }
  }, [examId])

  if (!examId) return <ErrorState message="Missing examId" />
  if (error) return <ErrorState message={error} />
  if (!result) return <LoadingState label="Loading result..." />

  return (
    <div>
      <h1>Result</h1>
      <div>Score: {result.scorePercent}%</div>
      <div>Pass: {String(result.passed)}</div>
    </div>
  )
}
