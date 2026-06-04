import { Button } from '@/shared/components/Button'
import type { AuthUser } from '@/domains/auth/types/auth.types'

type UserCardProps = {
  user: AuthUser
  isLoading?: boolean
  onLogout: () => void
}

export function UserCard({ user, isLoading = false, onLogout }: UserCardProps) {
  const displayName = user.full_name?.trim() || user.name

  return (
    <section className="user-card" aria-label="Current user">
      <div className="user-card__identity">
        <strong>{displayName}</strong>
        <span>{user.email}</span>
      </div>
      <Button type="button" disabled={isLoading} onClick={onLogout} className="button--secondary">
        {isLoading ? 'Logging out...' : 'Logout'}
      </Button>
    </section>
  )
}
