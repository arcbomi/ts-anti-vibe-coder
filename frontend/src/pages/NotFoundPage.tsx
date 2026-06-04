import { Link } from 'react-router-dom'

import { Card } from '@/shared/components/Card'

export function NotFoundPage() {
  return (
    <main className="page-shell">
      <Card>
        <section className="section-stack" aria-labelledby="not-found-title">
          <h1 id="not-found-title">Page not found</h1>
          <p className="section-lede">The route you opened does not exist in this app.</p>
          <p>
            <Link to="/">Go back to the app home</Link>
          </p>
        </section>
      </Card>
    </main>
  )
}
