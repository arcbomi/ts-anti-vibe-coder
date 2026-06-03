import { useCallback, useSyncExternalStore } from 'react'

import { authApi } from '@/domains/auth/api/authApi'
import { authStore } from '@/domains/auth/store/authStore'
import type { LoginRequest } from '@/domains/auth/types/auth.types'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export function useAuth() {
  const state = useSyncExternalStore(authStore.subscribe, authStore.getState, authStore.getInitialState)

  const login = useCallback(async (request: LoginRequest) => {
    const store = authStore.getState()
    store.setLoading(true)
    store.setError(null)

    try {
      const response = await authApi.login(request)
      authStore.getState().setToken(response.token)
      authStore.getState().setUser(response.user)
      return response
    } catch (error) {
      authStore.getState().setError(getErrorMessage(error))
      throw error
    } finally {
      authStore.getState().setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    authStore.getState().setLoading(true)
    authStore.getState().setError(null)

    try {
      await authApi.logout()
    } catch (error) {
      authStore.getState().setError(getErrorMessage(error))
    } finally {
      authStore.getState().clearAuth()
    }
  }, [])

  const loadCurrentUser = useCallback(async () => {
    authStore.getState().setLoading(true)
    authStore.getState().setError(null)

    try {
      const user = await authApi.getCurrentUser()
      authStore.getState().setUser(user)
      return user
    } catch (error) {
      authStore.getState().setError(getErrorMessage(error))
      authStore.getState().setUser(null)
      throw error
    } finally {
      authStore.getState().setLoading(false)
    }
  }, [])

  return {
    user: state.user,
    token: state.token,
    isAuthenticated: Boolean(state.token && state.user),
    isLoading: state.isLoading,
    error: state.error,
    login,
    logout,
    loadCurrentUser,
  }
}
