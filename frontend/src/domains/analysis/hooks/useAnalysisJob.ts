import { computed, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { getAnalysisJob } from '@/domains/analysis/api/analysisApi'
import { analysisStore } from '@/domains/analysis/store/analysisStore'
import type { AnalysisJob, AnalysisJobStatus } from '@/domains/analysis/types/analysis.types'
import { ApiError } from '@/shared/api/client'
import { useVanillaStore } from '@/shared/state/useVanillaStore'

const POLLING_INTERVAL_MS = 2500

function isTerminalStatus(status: AnalysisJobStatus) {
  return status === 'completed' || status === 'failed'
}

function getErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Failed to load analysis job.'
}

export function useAnalysisJob(jobId?: MaybeRefOrGetter<string | undefined>) {
  const state = useVanillaStore(analysisStore)

  const refresh = async () => {
    const currentJobId = toValue(jobId)

    if (!currentJobId) {
      analysisStore.getState().setCurrentJob(null)
      analysisStore.getState().setError('Missing analysis job id.')
      return null
    }

    analysisStore.getState().setLoading(true)
    analysisStore.getState().setError(null)

    try {
      const job = await getAnalysisJob(currentJobId)
      analysisStore.getState().setCurrentJob(job)
      return job
    } catch (error) {
      analysisStore.getState().setError(getErrorMessage(error))
      return null
    } finally {
      analysisStore.getState().setLoading(false)
    }
  }

  watch(
    () => toValue(jobId),
    (currentJobId, _, onCleanup) => {
      let isCancelled = false
      let timeoutId: ReturnType<typeof setTimeout> | null = null

      if (!currentJobId) {
        analysisStore.getState().setCurrentJob(null)
        analysisStore.getState().setError('Missing analysis job id.')
        return
      }

      const activeJobId = currentJobId
      analysisStore.getState().setCurrentJob(null)

      async function loadJob(showLoading: boolean): Promise<AnalysisJob | null> {
        if (showLoading) analysisStore.getState().setLoading(true)
        analysisStore.getState().setError(null)

        try {
          const job = await getAnalysisJob(activeJobId)
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

      onCleanup(() => {
        isCancelled = true
        if (timeoutId) clearTimeout(timeoutId)
      })
    },
    { immediate: true },
  )

  return {
    job: computed(() => state.value.currentJob),
    isLoading: computed(() => state.value.isLoading),
    error: computed(() => state.value.error),
    refresh,
  }
}
