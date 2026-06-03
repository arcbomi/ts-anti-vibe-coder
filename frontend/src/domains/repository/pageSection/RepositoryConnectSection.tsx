import { BotInstructionCard } from '@/domains/repository/components/BotInstructionCard'
import { RepoUrlInput } from '@/domains/repository/components/RepoUrlInput'
import { RepositoryStatusSection } from '@/domains/repository/pageSection/RepositoryStatusSection'
import { useRepositories } from '@/domains/repository/hooks/useRepositories'
import { ErrorState } from '@/shared/components/ErrorState'

export function RepositoryConnectSection() {
  const { repository, isCreating, error, createRepository } = useRepositories()
  const botUsername = import.meta.env.VITE_GITLAB_BOT_USERNAME ?? 'gitlab-server-userbot'

  return (
    <section>
      <h1>Connect GitLab repository</h1>
      <RepoUrlInput isLoading={isCreating} onSubmit={createRepository} />
      {error && <ErrorState message={error} />}
      {repository && (
        <>
          <BotInstructionCard botUsername={botUsername} />
          <RepositoryStatusSection />
        </>
      )}
    </section>
  )
}
