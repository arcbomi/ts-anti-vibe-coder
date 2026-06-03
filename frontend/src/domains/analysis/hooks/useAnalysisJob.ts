import { useEffect, useState } from 'react'
import { analysisApi } from '@/domains/analysis/api/analysisApi'
import type { AnalysisJob } from '@/domains/analysis/types/analysis.types'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Failed to load job'
}

export function useAnalysisJob(jobId?: string) {
  const [job, setJob] = useState<AnalysisJob | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) return

    let stopped = false
    const tick = async () => {
      try {
        const nextJob = await analysisApi.getJob(jobId)
        if (!stopped) setJob(nextJob)
      } catch (caughtError: unknown) {
        if (!stopped) setError(getErrorMessage(caughtError))
      }
    }

    void tick()
    const timer = setInterval(tick, 2000)

    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [jobId])

  return { job, error }
}
