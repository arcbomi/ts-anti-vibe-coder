import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { BotInstructionCard } from '@/domains/repository/components/BotInstructionCard'
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
    isSyncingTomorrow,
    error,
    syncMessage,
    loadRepositories,
    syncTomorrowProjects,
    selectRepository,
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
        Refresh from Tomorrow to pull the current connected user&apos;s succeeded projects. After that, the student adds
        the bot collaborator and the backend tracks question work status.
      </p>

      <Card>
        <section className="section-stack">
          <h2>Your repository list</h2>
          <p className="section-lede">
            Only projects marked <strong>Project succeeded</strong> are kept here. Refresh any time to resync from your
            Tomorrow profile.
          </p>
          <div className="button-row">
            <Button type="button" disabled={isSyncingTomorrow} onClick={() => void syncTomorrowProjects()}>
              {isSyncingTomorrow ? 'Syncing Tomorrow projects...' : 'Refresh from Tomorrow'}
            </Button>
          </div>
          {isLoadingRepositories ? <LoadingState label="Loading repositories..." /> : null}
          {isSyncingTomorrow ? <LoadingState label="Syncing Tomorrow projects..." /> : null}
          {syncMessage ? <div className="callout callout--success">{syncMessage}</div> : null}
          {repositories.length > 0 ? (
            <div className="repo-list">
              {repositories.map((item) => {
                const isSelected = repository?.id === item.id

                return (
                  <div key={item.id} className={`repo-card${isSelected ? ' repo-card--selected' : ''}`}>
                    <div className="section-stack--tight">
                      <strong>{item.gitea_project_path ?? item.gitea_repo_url}</strong>
                      <p><code>{item.gitea_repo_url}</code></p>
                      {item.tomorrow_audit_text ? <p>Audits: <strong>{item.tomorrow_audit_text}</strong></p> : null}
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
            <div className="callout callout--neutral">
              No succeeded Tomorrow projects found yet. Try <strong>Refresh from Tomorrow</strong>.
            </div>
          )}
        </section>
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
