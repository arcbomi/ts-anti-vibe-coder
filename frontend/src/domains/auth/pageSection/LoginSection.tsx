import { LoginForm } from '@/domains/auth/components/LoginForm'
import { Card } from '@/shared/components/Card'

type LoginSectionProps = {
  onLoginSuccess?: () => void
}

export function LoginSection({ onLoginSuccess }: LoginSectionProps) {
  return (
    <Card>
      <section aria-labelledby="login-title">
        <h1 id="login-title">Log in to start your codebase understanding exam.</h1>
        <p>This platform verifies real codebase understanding before students begin their exam.</p>
        <LoginForm onSuccess={onLoginSuccess} />
      </section>
    </Card>
  )
}
