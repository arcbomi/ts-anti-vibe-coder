import { ApiError, apiFetch } from '@/shared/api/client'
import type { AuthUser, LoginRequest, LoginResponse } from '@/domains/auth/types/auth.types'

export const authApi = {
  login: (request: LoginRequest) =>
    apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  logout: async () => {
    try {
      await apiFetch<Record<string, never>>('/auth/logout', { method: 'POST' })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMPTY_RESPONSE') return
      throw error
    }
  },

  getCurrentUser: () => apiFetch<AuthUser>('/auth/me'),
}
