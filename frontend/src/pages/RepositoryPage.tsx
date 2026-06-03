import { RepositoryConnectSection } from '@/domains/repository/pageSection/RepositoryConnectSection'
import { RepositoryStatusSection } from '@/domains/repository/pageSection/RepositoryStatusSection'

export function RepositoryPage({ mode }: { mode: 'connect' | 'status' }) {
  if (mode === 'connect') return <RepositoryConnectSection />
  return <RepositoryStatusSection />
}
