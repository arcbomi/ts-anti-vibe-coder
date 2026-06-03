import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { RepositoryConnectSection } from '../../src/domains/repository/pageSection/RepositoryConnectSection'
import { repositoryStore } from '../../src/domains/repository/store/repositoryStore'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  fetchMock.mockReset()
  repositoryStore.getState().clearRepository()
  localStorage.clear()
})

describe('repository integration flow', () => {
  it('submits a GitLab URL, shows bot instructions, checks bot access, and enables analysis start', async () => {
    localStorage.setItem('auth_token', 'jwt-from-backend')
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ repository_id: 'repo-1', gitlab_repo_url: 'https://gitlab.com/group/project', bot_access_status: 'unknown' }))
      .mockResolvedValueOnce(jsonResponse({ repository_id: 'repo-1', gitlab_repo_url: 'https://gitlab.com/group/project', bot_access_status: 'granted' }))

    render(<MemoryRouter><RepositoryConnectSection /></MemoryRouter>)

    await userEvent.type(screen.getByLabelText(/gitlab repository url/i), 'https://gitlab.com/group/project')
    await userEvent.click(screen.getByRole('button', { name: /connect repository/i }))

    expect(await screen.findByText(/add the gitlab-server-userbot/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /i already added the bot/i })).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /i already added the bot/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/repositories/repo-1/check-bot-access'),
      expect.objectContaining({ method: 'POST' }),
    ))
    expect(await screen.findByText(/granted/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /start ai analysis/i }).hasAttribute('disabled')).toBe(false)
  })

  it('shows a friendly access denied message when the bot is not a collaborator', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ repository_id: 'repo-1', gitlab_repo_url: 'https://gitlab.com/group/project', bot_access_status: 'unknown' }))
      .mockResolvedValueOnce(jsonResponse(null, false, { code: 'BOT_ACCESS_DENIED', message: 'Please add the bot as a collaborator.' }, 403))

    render(<MemoryRouter><RepositoryConnectSection /></MemoryRouter>)

    await userEvent.type(screen.getByLabelText(/gitlab repository url/i), 'https://gitlab.com/group/project')
    await userEvent.click(screen.getByRole('button', { name: /connect repository/i }))
    await userEvent.click(await screen.findByRole('button', { name: /i already added the bot/i }))

    expect(await screen.findByText(/please add the bot as a collaborator/i)).toBeTruthy()
  })
})

function jsonResponse(data: unknown, success = true, error: unknown = null, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ success, data, error }), { status, headers: { 'Content-Type': 'application/json' } }))
}
