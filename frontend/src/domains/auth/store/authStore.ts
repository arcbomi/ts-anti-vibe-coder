import { createStore } from 'zustand/vanilla'

import type { User } from '@/domains/auth/types/auth.types'

type AuthState = {
  token: string | null
  user: User | null
  setToken: (token: string | null) => void
  setUser: (user: User | null) => void
  logout: () => void
}

export const authStore = createStore<AuthState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null,
  user: null,
  setToken: (token) => {
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('auth_token', token)
      else localStorage.removeItem('auth_token')
    }
    set({ token })
  },
  setUser: (user) => set({ user }),
  logout: () => {
    if (typeof window !== 'undefined') localStorage.removeItem('auth_token')
    set({ token: null, user: null })
  },
}))
