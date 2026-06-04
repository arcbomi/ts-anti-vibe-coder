import { ApiError, apiFetch } from '@/shared/api/client'
import type { AuthUser, LoginRequest, LoginResponse, RawLoginResponse } from '@/domains/auth/types/auth.types'

function normalizeLoginResponse(response: RawLoginResponse): LoginResponse {
  return {
    user: response.user,
    token: response.access_token ?? response.token ?? '',
  }
}

export const authApi = {
  login: async (request: LoginRequest) => {
    const response = await apiFetch<RawLoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(request),
    })

    return normalizeLoginResponse(response)
  },

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
