import { useEffect, useState } from 'react'
import { analysisApi } from '@/domains/analysis/api/analysisApi'
import type { AnalysisJob } from '@/domains/analysis/types/analysis.types'

export function useAnalysisJob(jobId: string) {
  const [job, setJob] = useState<AnalysisJob | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stopped = false
    const tick = async () => {
      try {
        const j = await analysisApi.getJob(jobId)
        if (!stopped) setJob(j)
      } catch (e: any) {
        if (!stopped) setError(e?.message ?? 'Failed to load job')
      }
    }
    void tick()
    const t = setInterval(tick, 2000)
    return () => {
      stopped = true
      clearInterval(t)
    }
  }, [jobId])

  return { job, error }
}
