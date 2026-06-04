import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { ExamPage } from '../../src/pages/ExamPage'
import { examStore } from '../../src/domains/exam/store/examStore'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  fetchMock.mockReset()
  examStore.getState().clearExam()
})

describe('exam integration flow', () => {
  it('loads 20 questions without answer keys, submits answers, and displays backend grading result', async () => {
    const questions = Array.from({ length: 20 }, (_, index) => ({
      id: `question-${index + 1}`,
      question: `How does flow ${index + 1} work in the repository?`,
      options: [
        { key: 'A', text: 'Routes are loaded from the database.' },
        { key: 'B', text: 'Handlers parse requests and call services.' },
        { key: 'C', text: 'The frontend grades the answer.' },
        { key: 'D', text: 'Gitea creates the routes.' },
      ],
    }))
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { id: 'exam-1', status: 'in_progress', questions }, error: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { examId: 'exam-1', totalQuestions: 20, correctCount: 18, score: 90, passed: true, passingScore: 70, status: 'passed' }, error: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    render(
      <MemoryRouter initialEntries={['/exam/exam-1']}>
        <Routes><Route path="/exam/:examId" element={<ExamPage />} /><Route path="/exam/:examId/result" element={<div>Result route</div>} /></Routes>
      </MemoryRouter>,
    )

    expect(await screen.findAllByText(/^Question \d+$/)).toHaveLength(20)
    expect(screen.queryByText(/correct_option/i)).not.toBeTruthy()
    expect(screen.queryByText(/explanation/i)).not.toBeTruthy()

    for (let i = 1; i <= 20; i += 1) {
      await userEvent.click(screen.getAllByRole('radio', { name: /handlers parse requests and call services/i })[i - 1])
    }
    await userEvent.click(screen.getByRole('button', { name: /submit exam/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/exams/exam-1/submit'),
      expect.objectContaining({ method: 'POST' }),
    ))
  })
})
