import type { User } from '@/domains/auth/types/auth.types'

export function UserCard({ user }: { user: User }) {
  return (
    <div>
      <div>User</div>
      <div>{user.email}</div>
    </div>
  )
}
