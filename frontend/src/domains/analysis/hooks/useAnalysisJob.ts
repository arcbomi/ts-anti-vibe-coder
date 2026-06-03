import { useCallback, useEffect, useSyncExternalStore } from 'react'

import { getAnalysisJob } from '@/domains/analysis/api/analysisApi'
import { analysisStore } from '@/domains/analysis/store/analysisStore'
import type { AnalysisJob, AnalysisJobStatus } from '@/domains/analysis/types/analysis.types'
import { ApiError } from '@/shared/api/client'

const POLLING_INTERVAL_MS = 2500

function isTerminalStatus(status: AnalysisJobStatus) {
  return status === 'completed' || status === 'failed'
}

function getErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Failed to load analysis job.'
}

export function useAnalysisJob(jobId?: string) {
  const state = useSyncExternalStore(analysisStore.subscribe, analysisStore.getState)

  const refresh = useCallback(async () => {
    if (!jobId) {
      analysisStore.getState().setCurrentJob(null)
      analysisStore.getState().setError('Missing analysis job id.')
      return null
    }

    analysisStore.getState().setLoading(true)
    analysisStore.getState().setError(null)

    try {
      const job = await getAnalysisJob(jobId)
      analysisStore.getState().setCurrentJob(job)
      return job
    } catch (error) {
      analysisStore.getState().setError(getErrorMessage(error))
      return null
    } finally {
      analysisStore.getState().setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    let isCancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    if (!jobId) {
      analysisStore.getState().setCurrentJob(null)
      analysisStore.getState().setError('Missing analysis job id.')
      return undefined
    }

    const currentJobId = jobId
    analysisStore.getState().setCurrentJob(null)

    async function loadJob(showLoading: boolean): Promise<AnalysisJob | null> {
      if (showLoading) analysisStore.getState().setLoading(true)
      analysisStore.getState().setError(null)

      try {
        const job = await getAnalysisJob(currentJobId)
        if (!isCancelled) analysisStore.getState().setCurrentJob(job)
        return job
      } catch (error) {
        if (!isCancelled) analysisStore.getState().setError(getErrorMessage(error))
        return null
      } finally {
        if (showLoading && !isCancelled) analysisStore.getState().setLoading(false)
      }
    }

    async function poll(showLoading: boolean) {
      const job = await loadJob(showLoading)
      if (isCancelled || !job || isTerminalStatus(job.status)) return

      timeoutId = setTimeout(() => {
        void poll(false)
      }, POLLING_INTERVAL_MS)
    }

    void poll(true)

    return () => {
      isCancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [jobId])

  return {
    job: state.currentJob,
    isLoading: state.isLoading,
    error: state.error,
    refresh,
  }
}
