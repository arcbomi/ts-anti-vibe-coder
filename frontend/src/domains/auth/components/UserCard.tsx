import { Button } from '@/shared/components/Button'
import type { AuthUser } from '@/domains/auth/types/auth.types'

type UserCardProps = {
  user: AuthUser
  isLoading?: boolean
  onLogout: () => void
}

export function UserCard({ user, isLoading = false, onLogout }: UserCardProps) {
  return (
    <section aria-label="Current user">
      <div>{user.name}</div>
      <div>{user.email}</div>
      <Button type="button" disabled={isLoading} onClick={onLogout}>
        {isLoading ? 'Logging out...' : 'Logout'}
      </Button>
    </section>
  )
}
