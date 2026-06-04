import { useNavigate } from 'react-router-dom'

import { LoginSection } from '@/domains/auth/pageSection/LoginSection'

export function LoginPage() {
  const navigate = useNavigate()

  return (
    <main className="page-shell">
      <LoginSection onLoginSuccess={() => navigate('/dashboard')} />
    </main>
  )
}
