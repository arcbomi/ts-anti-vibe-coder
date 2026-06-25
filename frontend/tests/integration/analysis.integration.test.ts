import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AnalysisJobStatus } from '../../src/domains/analysis/types/analysis.types'
import { canUseZustandStores, renderRouteView, screen } from '../support/integrationHarness'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  fetchMock.mockReset()
})

afterEach(async () => {
  if (!canUseZustandStores) {
    return
  }

  const { analysisStore } = await import('../../src/domains/analysis/store/analysisStore')
  analysisStore.getState().setCurrentJob(null)
  analysisStore.getState().setError(null)
})

describe('analysis integration flow', () => {
  it.each([
    'pending',
    'checking_bot_access',
    'reading_repository',
    'indexing_code',
    'analyzing_code',
    'generating_questions',
    'saving_questions',
    'completed',
    'failed',
  ] satisfies AnalysisJobStatus[])('renders backend analysis status %s', async (status) => {
    const { default: AnalysisPage } = await import('../../src/pages/AnalysisPage.vue')

    const statusLabel = {
      pending: 'Pending',
      checking_bot_access: 'Checking bot access',
      reading_repository: 'Reading repository',
      indexing_code: 'Indexing code',
      analyzing_code: 'Analyzing code',
      generating_questions: 'Generating questions',
      saving_questions: 'Saving questions',
      completed: 'Completed',
      failed: 'Failed',
    }[status]

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      success: true,
      data: { id: 'job-1', repositoryId: 'repo-1', status, createdAt: '2026-06-03T00:00:00Z', errorMessage: status === 'failed' ? 'AI output invalid.' : undefined },
      error: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await renderRouteView({
      initialEntry: '/analysis/job-1',
      routes: [{ path: '/analysis/:jobId', component: AnalysisPage }],
    })

    expect(await screen.findByLabelText(new RegExp(`analysis status: ${statusLabel}`, 'i'))).toBeTruthy()
  })
})
