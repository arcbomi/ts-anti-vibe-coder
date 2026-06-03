import { useEffect } from 'react'

import { UserCard } from '@/domains/auth/components/UserCard'
import { useAuth } from '@/domains/auth/hooks/useAuth'
import { Card } from '@/shared/components/Card'
import { ErrorState } from '@/shared/components/ErrorState'
import { LoadingState } from '@/shared/components/LoadingState'

export function AuthHeaderSection() {
  const { error, isLoading, loadCurrentUser, logout, token, user } = useAuth()

  useEffect(() => {
    if (token && !user) void loadCurrentUser()
  }, [loadCurrentUser, token, user])

  return (
    <Card>
      <header>
        <h1>Account</h1>
        {isLoading && !user ? <LoadingState label="Loading current user..." /> : null}
        {error ? <ErrorState message={error} /> : null}
        {user ? <UserCard user={user} isLoading={isLoading} onLogout={logout} /> : <div>Not logged in</div>}
      </header>
    </Card>
  )
}
