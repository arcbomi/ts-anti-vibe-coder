import { useAuth } from '@/domains/auth/hooks/useAuth'
import { UserCard } from '@/domains/auth/components/UserCard'
import { Card } from '@/shared/components/Card'

export function AuthHeaderSection() {
  const { user } = useAuth()

  return (
    <Card>
      <h1>Dashboard</h1>
      {user ? <UserCard user={user} /> : <div>Not logged in</div>}
    </Card>
  )
}
