import { apiFetch } from '@/shared/api/client'
import type { LoginRequest, LoginResponse, User } from '@/domains/auth/types/auth.types'

export const authApi = {
  login: (req: LoginRequest) =>
    apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify(req) }),
  me: () => apiFetch<User>('/me'),
}
