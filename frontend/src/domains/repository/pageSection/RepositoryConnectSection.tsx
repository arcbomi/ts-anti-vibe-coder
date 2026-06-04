import { Link } from 'react-router-dom'
import { BotInstructionCard } from '@/domains/repository/components/BotInstructionCard'
import { RepoUrlInput } from '@/domains/repository/components/RepoUrlInput'
import { useRepositories } from '@/domains/repository/hooks/useRepositories'
import { RepositoryStatusSectionContent } from '@/domains/repository/pageSection/RepositoryStatusSection'
import { Card } from '@/shared/components/Card'
import { ErrorState } from '@/shared/components/ErrorState'

export function RepositoryConnectSection() {
  const { repository, isCreating, error, createRepository } = useRepositories()
  const botUsername = import.meta.env.VITE_GITLAB_BOT_USERNAME ?? 'gitlab-server-userbot'

  return (
    <section className="section-stack">
      <p className="eyebrow">Step 1</p>
      <h1>Connect your GitLab repository</h1>
      <p className="section-lede">
        Submit the repository URL first. The platform will only read code after the GitLab userbot is added and
        access is confirmed.
      </p>

      <Card>
        <RepoUrlInput
          isLoading={isCreating}
          onSubmit={async (gitlabRepoUrl) => {
            await createRepository(gitlabRepoUrl)
          }}
        />
      </Card>

      {error && <ErrorState message={error} />}
      <BotInstructionCard botUsername={botUsername} />
      {repository ? (
        <div className="callout callout--success">
          Repository saved. You can continue below or open the dedicated
          {' '}
          <Link to="/repository/status">repository status page</Link>.
        </div>
      ) : null}
      {repository ? <RepositoryStatusSectionContent showInstructionCard={false} /> : null}
    </section>
  )
}
