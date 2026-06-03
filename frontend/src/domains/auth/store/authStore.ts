import { createStore } from 'zustand/vanilla'

import type { AuthState, AuthUser } from '@/domains/auth/types/auth.types'

type AuthActions = {
  setUser: (user: AuthUser | null) => void
  setToken: (token: string | null) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  clearAuth: () => void
}

export type AuthStore = AuthState & AuthActions

const AUTH_TOKEN_KEY = 'auth_token'

function readStoredToken() {
  return typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null
}

function writeStoredToken(token: string | null) {
  if (typeof window === 'undefined') return

  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token)
  else localStorage.removeItem(AUTH_TOKEN_KEY)
}

export const authStore = createStore<AuthStore>((set) => ({
  user: null,
  token: readStoredToken(),
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),
  setToken: (token) => {
    writeStoredToken(token)
    set({ token })
  },
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearAuth: () => {
    writeStoredToken(null)
    set({ user: null, token: null, isLoading: false, error: null })
  },
}))
