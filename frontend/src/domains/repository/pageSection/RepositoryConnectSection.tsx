import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { BotInstructionCard } from '@/domains/repository/components/BotInstructionCard'
import { RepoUrlInput } from '@/domains/repository/components/RepoUrlInput'
import { useRepositories } from '@/domains/repository/hooks/useRepositories'
import { RepositoryStatusSectionContent } from '@/domains/repository/pageSection/RepositoryStatusSection'
import type { Repository } from '@/domains/repository/types/repository.types'
import { Card } from '@/shared/components/Card'
import { Button } from '@/shared/components/Button'
import { ErrorState } from '@/shared/components/ErrorState'
import { LoadingState } from '@/shared/components/LoadingState'

function questionWorkLabel(repository: Repository) {
  switch (repository.latestAnalysisStatus) {
    case 'checking_bot_access':
      return 'Checking bot access'
    case 'reading_repository':
      return 'Downloading repository'
    case 'indexing_code':
      return 'Indexing code'
    case 'analyzing_code':
      return 'Analyzing code'
    case 'generating_questions':
      return 'Generating questions'
    case 'saving_questions':
      return 'Saving questions'
    case 'completed':
      return 'Questions ready'
    case 'failed':
      return repository.latestAnalysisErrorMessage ?? 'Question work failed'
    default:
      return 'Not started'
  }
}

export function RepositoryConnectSection() {
  const navigate = useNavigate()
  const {
    repositories,
    repository,
    isLoadingRepositories,
    isCreating,
    error,
    loadRepositories,
    selectRepository,
    createRepository,
  } = useRepositories()
  const botUsername = import.meta.env.VITE_GITEA_BOT_USERNAME ?? 'gitea-server-userbot'

  useEffect(() => {
    void loadRepositories()
  }, [])

  return (
    <section className="section-stack">
      <p className="eyebrow">Step 1</p>
      <h1>Choose the repository to test</h1>
      <p className="section-lede">
        Students choose a repository first. After that, they add the bot collaborator themselves and the backend
        tracks question work status as the bot checks and downloads the code.
      </p>

      <Card>
        <section className="section-stack">
          <h2>Your repository list</h2>
          <p className="section-lede">
            Pick one repository for this verification run. If the one you need is missing, you can still add it by URL
            below.
          </p>
          {isLoadingRepositories ? <LoadingState label="Loading repositories..." /> : null}
          {repositories.length > 0 ? (
            <div className="repo-list">
              {repositories.map((item) => {
                const isSelected = repository?.id === item.id

                return (
                  <div key={item.id} className={`repo-card${isSelected ? ' repo-card--selected' : ''}`}>
                    <div className="section-stack--tight">
                      <strong>{item.gitea_repo_url}</strong>
                      <p>Bot access: <strong>{item.bot_access_status}</strong></p>
                      <p>Question work: <strong>{questionWorkLabel(item)}</strong></p>
                    </div>
                    <div className="button-row">
                      <Button
                        type="button"
                        onClick={() => {
                          selectRepository(item)
                          navigate('/repository/status')
                        }}
                      >
                        {isSelected ? 'Continue with this repo' : 'Choose this repo'}
                      </Button>
                      {item.latestAnalysisJobId ? (
                        <Button type="button" className="button button--secondary" onClick={() => navigate(`/analysis/${item.latestAnalysisJobId}`)}>
                          Open question work
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p>No repositories have been saved for this account yet.</p>
          )}
        </section>
      </Card>

      <Card>
        <RepoUrlInput
          isLoading={isCreating}
          onSubmit={async (giteaRepoUrl) => {
            const nextRepository = await createRepository(giteaRepoUrl)
            if (!nextRepository) return
            selectRepository(nextRepository)
          }}
        />
      </Card>

      {error && <ErrorState message={error} />}
      <BotInstructionCard botUsername={botUsername} />
      {repository ? (
        <div className="callout callout--success">
          Repository selected. Continue below or open the
          {' '}
          <Link to="/repository/status">repository status page</Link>.
        </div>
      ) : null}
      {repository ? <RepositoryStatusSectionContent showInstructionCard={false} /> : null}
    </section>
  )
}
