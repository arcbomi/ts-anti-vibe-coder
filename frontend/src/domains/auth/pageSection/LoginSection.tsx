import { useNavigate } from 'react-router-dom'

import { LoginForm } from '@/domains/auth/components/LoginForm'
import { authApi } from '@/domains/auth/api/authApi'
import { authStore } from '@/domains/auth/store/authStore'
import { Card } from '@/shared/components/Card'

export function LoginSection() {
  const nav = useNavigate()

  return (
    <Card>
      <h1>Login</h1>
      <p>Future support: Tomorrow School accounts / SSO.</p>
      <LoginForm
        onSubmit={async (email, password) => {
          const resp = await authApi.login({ email, password })
          authStore.getState().setToken(resp.token)
          authStore.getState().setUser(resp.user)
          nav('/dashboard')
        }}
      />
    </Card>
  )
}
