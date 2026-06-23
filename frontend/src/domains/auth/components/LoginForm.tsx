import type { FormEvent } from 'react'
import { useState } from 'react'

import { Button } from '@/shared/components/Button'
import { ErrorState } from '@/shared/components/ErrorState'
import { LoadingState } from '@/shared/components/LoadingState'
import { useAuth } from '@/domains/auth/hooks/useAuth'

type LoginFormProps = {
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { error, isLoading, login } = useAuth()
  const [credential, setCredential] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await login({ credential, password })
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="auth-credential">Email or username</label>
        <input
          id="auth-credential"
          name="credential"
          type="text"
          value={credential}
          autoComplete="username"
          placeholder="student@example.com or student-user"
          required
          onChange={(event) => setCredential(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          name="password"
          type="password"
          value={password}
          autoComplete="current-password"
          required
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {error ? <ErrorState message={error} /> : null}
      {isLoading ? <LoadingState label="Signing in..." /> : null}

      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Log in'}
      </Button>
    </form>
  )
}
