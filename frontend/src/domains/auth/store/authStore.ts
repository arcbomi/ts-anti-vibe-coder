import { readonly, shallowRef } from 'vue'

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

const state = shallowRef<AuthState>({
  user: null,
  token: readStoredToken(),
  isLoading: false,
  error: null,
})

const listeners = new Set<() => void>()

let snapshot: AuthStore

function emitChange() {
  for (const listener of listeners) listener()
}

function refreshSnapshot() {
  snapshot = {
    ...state.value,
    ...actions,
  }
}

function updateState(nextState: Partial<AuthState>) {
  state.value = { ...state.value, ...nextState }
  refreshSnapshot()
  emitChange()
}

const actions: AuthActions = {
  setUser: (user) => {
    updateState({ user })
  },
  setToken: (token) => {
    writeStoredToken(token)
    updateState({ token })
  },
  setLoading: (isLoading) => {
    updateState({ isLoading })
  },
  setError: (error) => {
    updateState({ error })
  },
  clearAuth: () => {
    writeStoredToken(null)
    state.value = { user: null, token: null, isLoading: false, error: null }
    refreshSnapshot()
    emitChange()
  },
}
refreshSnapshot()

export const authState = readonly(state)

export const authStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  },
  getState() {
    return snapshot
  },
  getInitialState() {
    return snapshot
  },
}
