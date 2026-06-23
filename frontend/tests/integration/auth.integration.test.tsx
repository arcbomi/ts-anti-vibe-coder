import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { LoginPage } from '../../src/pages/LoginPage'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  fetchMock.mockReset()
  localStorage.clear()
  window.history.pushState({}, '', '/')
})

describe('auth integration flow', () => {
  it('opens the login page, submits credentials, stores backend token, and redirects to dashboard', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      success: true,
      data: {
        access_token: 'jwt-from-backend',
        user: { id: 'user-1', email: 'student@example.com', name: 'student-user', full_name: 'Student User' },
      },
      error: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText(/email or username/i), 'student@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'correct-password')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ credential: 'student@example.com', password: 'correct-password' }),
      }),
    ))
    expect(localStorage.getItem('auth_token')).toBe('jwt-from-backend')
    expect(await screen.findByText('Dashboard')).toBeTruthy()
  })
})
