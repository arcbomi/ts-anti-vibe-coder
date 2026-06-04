import { AuthHeaderSection } from '@/domains/auth/pageSection/AuthHeaderSection'
import { RepositoryOverviewSection } from '@/domains/repository/pageSection/RepositoryOverviewSection'

export function DashboardPage() {
  return (
    <main className="page-shell">
      <AuthHeaderSection />
      <RepositoryOverviewSection />
    </main>
  )
}
