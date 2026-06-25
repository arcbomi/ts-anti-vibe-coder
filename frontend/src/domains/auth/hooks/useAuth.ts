import { computed } from 'vue'

import { authApi } from '@/domains/auth/api/authApi'
import { authStore } from '@/domains/auth/store/authStore'
import type { LoginRequest } from '@/domains/auth/types/auth.types'
import { useVanillaStore } from '@/shared/state/useVanillaStore'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export function useAuth() {
  const state = useVanillaStore(authStore)

  const login = async (request: LoginRequest) => {
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
  }

  const logout = async () => {
    authStore.getState().setLoading(true)
    authStore.getState().setError(null)

    try {
      await authApi.logout()
    } catch (error) {
      authStore.getState().setError(getErrorMessage(error))
    } finally {
      authStore.getState().clearAuth()
    }
  }

  const loadCurrentUser = async () => {
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
  }

  return {
    user: computed(() => state.value.user),
    token: computed(() => state.value.token),
    isAuthenticated: computed(() => Boolean(state.value.token && state.value.user)),
    isLoading: computed(() => state.value.isLoading),
    error: computed(() => state.value.error),
    login,
    logout,
    loadCurrentUser,
  }
}
