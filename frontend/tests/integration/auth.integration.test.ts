import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderRouteView, screen, typeText, click, waitFor } from '../support/integrationHarness'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  fetchMock.mockReset()
  localStorage.clear()
  window.history.pushState({}, '', '/')
})

describe('auth integration flow', () => {
  it('opens the login page, submits credentials, stores backend token, and redirects to dashboard', async () => {
    const { default: LoginPage } = await import('../../src/pages/LoginPage.vue')
    const DashboardStub = { template: '<div>Dashboard</div>' }

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      success: true,
      data: {
        access_token: 'jwt-from-backend',
        user: { id: 'user-1', email: 'student@example.com', name: 'student-user', full_name: 'Student User' },
      },
      error: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await renderRouteView({
      initialEntry: '/login',
      routes: [
        { path: '/login', component: LoginPage },
        { path: '/dashboard', component: DashboardStub },
      ],
    })

    await typeText(screen.getByLabelText(/email or username/i), 'student@example.com')
    await typeText(screen.getByLabelText(/password/i), 'correct-password')
    await click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ credential: 'student@example.com', password: 'correct-password' }),
      }),
    ))
    await waitFor(() => expect(localStorage.getItem('auth_token')).toBe('jwt-from-backend'))
    expect(await screen.findByText('Dashboard')).toBeTruthy()
  })
})
