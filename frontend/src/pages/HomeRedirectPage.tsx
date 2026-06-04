import { useSyncExternalStore } from 'react'
import { Navigate } from 'react-router-dom'

import { authStore } from '@/domains/auth/store/authStore'

export function HomeRedirectPage() {
  const { token } = useSyncExternalStore(authStore.subscribe, authStore.getState, authStore.getInitialState)

  return <Navigate replace to={token ? '/dashboard' : '/login'} />
}
