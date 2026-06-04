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
  repositoryStore.getState().reset()
  localStorage.clear()
  sessionStorage.clear()
})

describe('repository integration flow', () => {
  it('loads the user repository list, lets the user choose a repo, checks bot access, and enables question work', async () => {
    localStorage.setItem('auth_token', 'jwt-from-backend')
    fetchMock
      .mockResolvedValueOnce(jsonResponse([
        {
          repository_id: 'repo-1',
          gitea_repo_url: 'https://gitea.com/group/project',
          bot_access_status: 'unknown',
          latest_analysis_status: null,
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({ repository_id: 'repo-1', gitea_repo_url: 'https://gitea.com/group/project', bot_access_status: 'granted' }))

    render(<MemoryRouter><RepositoryConnectSection /></MemoryRouter>)

    expect(await screen.findByText(/your repository list/i)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /choose this repo/i }))

    expect(await screen.findByText(/add the gitea userbot/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /i already added the bot/i })).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /i already added the bot/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/repositories/repo-1/check-bot-access'),
      expect.objectContaining({ method: 'POST' }),
    ))
    expect(await screen.findByText(/bot access confirmed/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /start question work/i }).hasAttribute('disabled')).toBe(false)
  })

  it('shows a friendly access denied message when the bot is not a collaborator', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([
        {
          repository_id: 'repo-1',
          gitea_repo_url: 'https://gitea.com/group/project',
          bot_access_status: 'unknown',
        },
      ]))
      .mockResolvedValueOnce(jsonResponse(null, false, { code: 'BOT_ACCESS_DENIED', message: 'Please add the bot as a collaborator.' }, 403))

    render(<MemoryRouter><RepositoryConnectSection /></MemoryRouter>)

    await userEvent.click(await screen.findByRole('button', { name: /choose this repo/i }))
    await userEvent.click(await screen.findByRole('button', { name: /i already added the bot/i }))

    expect((await screen.findAllByText(/please add the bot as a collaborator/i)).length).toBeGreaterThan(0)
  })
})

function jsonResponse(data: unknown, success = true, error: unknown = null, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ success, data, error }), { status, headers: { 'Content-Type': 'application/json' } }))
}
