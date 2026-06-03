import { useSyncExternalStore } from 'react'
import { authStore } from '@/domains/auth/store/authStore'

export function useAuth() {
  const state = useSyncExternalStore(authStore.subscribe, authStore.getState)
  return state
}
