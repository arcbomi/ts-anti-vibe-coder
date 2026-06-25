import { afterEach, describe, expect, it, vi } from 'vitest'

import { canUseZustandStores, click, renderRouteView, screen, waitFor } from '../support/integrationHarness'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  vi.useRealTimers()
  fetchMock.mockReset()
  window.localStorage.clear()
})

afterEach(async () => {
  if (!canUseZustandStores) {
    return
  }

  const [{ authStore }, { examStore }] = await Promise.all([
    import('../../src/domains/auth/store/authStore'),
    import('../../src/domains/exam/store/examStore'),
  ])

  examStore.getState().clearExam()
  authStore.getState().clearAuth()
})

describe('exam integration flow', () => {
  it('loads 20 questions without answer keys, blocks incomplete submit, then submits once and shows the result page', async () => {
    const { default: ExamPage } = await import('../../src/pages/ExamPage.vue')
    const { default: ExamResultPage } = await import('../../src/pages/ExamResultPage.vue')

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
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)

      if (url.includes('/exams/exam-1/submit')) {
        return new Response(JSON.stringify({
          success: true,
          data: { examId: 'exam-1', submitted: true },
          error: null,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      if (url.includes('/exams/exam-1/result')) {
        return new Response(JSON.stringify({
          success: true,
          data: {
            examId: 'exam-1',
            project_slug: 'forum',
            totalQuestions: 20,
            correctCount: 18,
            score: 90,
            passed: true,
            passingScore: 70,
            status: 'passed',
          },
          error: null,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      if (url.includes('/exams/exam-1') && (init?.method === 'GET' || !init?.method)) {
        return new Response(JSON.stringify({
          success: true,
          data: { id: 'exam-1', status: 'in_progress', project_slug: 'forum', questions },
          error: null,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    await renderRouteView({
      initialEntry: '/exam/exam-1',
      routes: [
        { path: '/exam/:examId', component: ExamPage },
        { path: '/exam/:examId/result', component: ExamResultPage },
      ],
    })

    expect(await screen.findByRole('heading', { name: 'Forum' })).toBeTruthy()
    expect(await screen.findAllByText(/^Question \d+$/)).toHaveLength(20)
    expect(screen.queryByText(/correct_option/i)).not.toBeTruthy()
    expect(screen.queryByText(/explanation/i)).not.toBeTruthy()
    expect(screen.getByText(/you can submit this exam only once/i)).toBeTruthy()

    await click(screen.getByRole('button', { name: /submit exam/i }))
    expect(await screen.findByText(/answer all 20 questions before submitting/i)).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    for (let i = 1; i <= 20; i += 1) {
      await click(screen.getAllByRole('radio', { name: /handlers parse requests and call services/i })[i - 1])
    }
    await click(screen.getByRole('button', { name: /submit exam/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/exams/exam-1/submit'),
      expect.objectContaining({ method: 'POST' }),
    ))

    expect(await screen.findByRole('heading', { name: /exam result/i })).toBeTruthy()
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/submit'))).toHaveLength(1)
    expect(screen.getByText('Forum')).toBeTruthy()
    expect(screen.getByText('90')).toBeTruthy()
  })

  it('restores selected answers after a page refresh for the same exam', async () => {
    const { default: ExamPage } = await import('../../src/pages/ExamPage.vue')
    const { examStore } = await import('../../src/domains/exam/store/examStore')

    const questions = Array.from({ length: 20 }, (_, index) => ({
      id: `question-${index + 1}`,
      question: `How does flow ${index + 1} work in the repository?`,
      options: [
        { key: 'A', text: `Wrong answer ${index + 1}A` },
        { key: 'B', text: `Correct answer ${index + 1}B` },
        { key: 'C', text: `Wrong answer ${index + 1}C` },
        { key: 'D', text: `Wrong answer ${index + 1}D` },
      ],
    }))

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)

      if (url.includes('/exams/exam-1') && (init?.method === 'GET' || !init?.method)) {
        return new Response(JSON.stringify({
          success: true,
          data: { id: 'exam-1', status: 'in_progress', project_slug: 'go-reloaded', questions },
          error: null,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    const firstRender = await renderRouteView({
      initialEntry: '/exam/exam-1',
      routes: [{ path: '/exam/:examId', component: ExamPage }],
    })

    expect(await screen.findByRole('heading', { name: 'Go Reloaded' })).toBeTruthy()
    await click(screen.getByRole('radio', { name: /Correct answer 1B/i }))
    await click(screen.getByRole('radio', { name: /Correct answer 2B/i }))
    firstRender.unmount()
    examStore.getState().clearExam()

    await renderRouteView({
      initialEntry: '/exam/exam-1',
      routes: [{ path: '/exam/:examId', component: ExamPage }],
    })

    expect(await screen.findByRole('heading', { name: 'Go Reloaded' })).toBeTruthy()
    const restoredSelections = screen.getAllByRole('radio', { checked: true })
    expect(restoredSelections).toHaveLength(2)
    expect(screen.getAllByText('2 / 20 answered')).toHaveLength(2)
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/exams/exam-1'))).toHaveLength(2)
  })

  it('loads succeeded projects and updates a project to ready after try pass', async () => {
    const { default: DashboardPage } = await import('../../src/pages/DashboardPage.vue')
    const { authStore } = await import('../../src/domains/auth/store/authStore')

    vi.useFakeTimers({ shouldAdvanceTime: true })
    authStore.getState().setToken('token-1')

    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: { id: 'user-1', email: 'student@example.com', name: 'Student', full_name: 'Student User' },
        error: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: {
          projects: [
            {
              project_slug: 'forum',
              project_name: 'Forum',
              project_status: 'Project succeeded',
              repo_url: 'https://example.com/git/student/forum',
              audit_text: '5 peer audits required',
              preparation_status: 'not_started',
            },
          ],
        },
        error: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { project_slug: 'forum', preparation_status: 'preparing', attempt_id: 'attempt-42' }, error: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: {
          projects: [
            {
              project_slug: 'forum',
              project_name: 'Forum',
              project_status: 'Project succeeded',
              repo_url: 'https://example.com/git/student/forum',
              audit_text: '5 peer audits required',
              preparation_status: 'ready_to_pass',
              exam_id: 'exam-42',
            },
          ],
        },
        error: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await renderRouteView({
      initialEntry: '/dashboard',
      routes: [{ path: '/dashboard', component: DashboardPage }],
    })

    expect(await screen.findByText('Forum')).toBeTruthy()
    await click(screen.getByRole('button', { name: /try pass/i }))

    expect(await screen.findByRole('button', { name: 'Preparing' })).toBeTruthy()
    await vi.advanceTimersByTimeAsync(5000)
    expect(await screen.findByRole('button', { name: /start exam/i })).toBeTruthy()

    const callsAfterReady = fetchMock.mock.calls.length
    await vi.advanceTimersByTimeAsync(10000)
    expect(fetchMock).toHaveBeenCalledTimes(callsAfterReady)
  })
})
