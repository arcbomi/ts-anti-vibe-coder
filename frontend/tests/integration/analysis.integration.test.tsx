import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AnalysisPage } from '../../src/pages/AnalysisPage'
import { analysisStore } from '../../src/domains/analysis/store/analysisStore'
import type { AnalysisJobStatus } from '../../src/domains/analysis/types/analysis.types'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  fetchMock.mockReset()
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
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      success: true,
      data: { id: 'job-1', repositoryId: 'repo-1', status, createdAt: '2026-06-03T00:00:00Z', errorMessage: status === 'failed' ? 'AI output invalid.' : undefined },
      error: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    render(
      <MemoryRouter initialEntries={['/analysis/job-1']}>
        <Routes><Route path="/analysis/:jobId" element={<AnalysisPage />} /></Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText(status)).toBeTruthy()
  })
})
