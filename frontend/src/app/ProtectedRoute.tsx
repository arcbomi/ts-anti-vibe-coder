import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { authStore } from '@/domains/auth/store/authStore'
import { useAuth } from '@/domains/auth/hooks/useAuth'
import { LoadingState } from '@/shared/components/LoadingState'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { token, user, isLoading, error, loadCurrentUser } = useAuth()

  useEffect(() => {
    if (token && !user && !isLoading) {
      void loadCurrentUser().catch(() => {
        authStore.getState().clearAuth()
      })
    }
  }, [isLoading, loadCurrentUser, token, user])

  if (!token) {
    return <Navigate replace to="/login" state={{ from: location.pathname }} />
  }

  if (isLoading && !user) {
    return <LoadingState label="Checking your session..." />
  }

  if (error && !user) {
    return <Navigate replace to="/login" state={{ from: location.pathname }} />
  }

  if (!user) {
    return <LoadingState label="Preparing your dashboard..." />
  }

  return <>{children}</>
}
