import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'

import { BotInstructionCard } from '@/domains/repository/components/BotInstructionCard'
import { BotAccessStatus } from '@/domains/repository/components/BotAccessStatus'
import { useBotAccessCheck } from '@/domains/repository/hooks/useBotAccessCheck'
import { useRepositories } from '@/domains/repository/hooks/useRepositories'
import { Card } from '@/shared/components/Card'
import { Button } from '@/shared/components/Button'
import { ErrorState } from '@/shared/components/ErrorState'
import { LoadingState } from '@/shared/components/LoadingState'

export function RepositoryStatusSection() {
  return <RepositoryStatusSectionContent />
}

type RepositoryStatusSectionContentProps = {
  showInstructionCard?: boolean
}

function questionWorkStatus(status?: string | null) {
  switch (status) {
    case 'checking_bot_access':
      return 'Checking whether the bot can access the repository.'
    case 'reading_repository':
      return 'The bot is downloading readable repository files now.'
    case 'indexing_code':
      return 'Repository files were downloaded. The backend is indexing code.'
    case 'analyzing_code':
      return 'The backend is analyzing the repository.'
    case 'generating_questions':
      return 'Question generation is running.'
    case 'saving_questions':
      return 'Questions are being saved.'
    case 'completed':
      return 'Questions are ready.'
    case 'failed':
      return 'Question work failed.'
    default:
      return 'Question work has not started yet.'
  }
}

export function RepositoryStatusSectionContent({ showInstructionCard = true }: RepositoryStatusSectionContentProps) {
  const navigate = useNavigate()
  const {
    repositories,
    repository,
    error,
    isLoadingRepositories,
    isCheckingBotAccess,
    isStartingAnalysis,
    loadRepositories,
    selectRepository,
    startAnalysis,
  } = useRepositories()
  const { checkBotAccess } = useBotAccessCheck()
  const botUsername = import.meta.env.VITE_GITEA_BOT_USERNAME ?? 'gitea-server-userbot'

  useEffect(() => {
    if (!repository && repositories.length === 0) {
      void loadRepositories()
    }
  }, [repositories.length, repository])

  if (!repository) {
    return (
      <Card>
        <section className="section-stack">
          <h1>Repository access status</h1>
          <p className="section-lede">Choose the repository you want to test before checking bot access.</p>
          {isLoadingRepositories ? <LoadingState label="Loading repositories..." /> : null}
          {repositories.length > 0 ? (
            <div className="repo-list">
              {repositories.map((item) => (
                <div key={item.id} className="repo-card">
                  <div className="section-stack--tight">
                    <strong>{item.gitea_project_path ?? item.gitea_repo_url}</strong>
                    <p><code>{item.gitea_repo_url}</code></p>
                    {item.tomorrow_audit_text ? <p>Audits: {item.tomorrow_audit_text}</p> : null}
                    <p>Question work: {questionWorkStatus(item.latestAnalysisStatus)}</p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      selectRepository(item)
                    }}
                  >
                    Choose this repo
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p>
              <Link to="/repository/connect">Refresh from Tomorrow</Link>
            </p>
          )}
        </section>
      </Card>
    )
  }

  const isAccessGranted = repository.bot_access_status === 'granted'

  return (
    <section className="section-stack">
      <p className="eyebrow">Step 2</p>
      <h1>Repository access status</h1>
      <p className="section-lede">
        The student adds the bot collaborator manually. After that, the backend checks access, downloads the
        repository through the bot account, and updates question work status.
      </p>
      {showInstructionCard ? <BotInstructionCard botUsername={botUsername} /> : null}
      <Card>
        <section className="section-stack">
          <p className="section-lede">
            Repository: <code>{repository.gitea_repo_url}</code>
          </p>
          {repository.tomorrow_audit_text ? <p>Audits: {repository.tomorrow_audit_text}</p> : null}
          <BotAccessStatus status={repository.bot_access_status} />
          <p>Question work status: {questionWorkStatus(repository.latestAnalysisStatus)}</p>
          {repository.latestAnalysisStatus === 'failed' && repository.latestAnalysisErrorMessage ? (
            <p>{repository.latestAnalysisErrorMessage}</p>
          ) : null}
          {error && <ErrorState message={error} />}
          {isCheckingBotAccess && <LoadingState label="Checking bot access..." />}
          <div className="button-row">
            <Button type="button" disabled={isCheckingBotAccess} onClick={() => void checkBotAccess()}>
              I already added the bot
            </Button>
            <Button
              type="button"
              disabled={!isAccessGranted || isStartingAnalysis}
              onClick={async () => {
                const analysisJobId = await startAnalysis()
                if (analysisJobId) navigate(`/analysis/${analysisJobId}`)
              }}
            >
              {isStartingAnalysis ? 'Starting question work...' : 'Start question work'}
            </Button>
          </div>
        </section>
      </Card>
      {repositories.length > 1 ? (
        <Card>
          <section className="section-stack">
            <h2>Choose another repository</h2>
            <div className="repo-list">
              {repositories
                .filter((item) => item.id !== repository.id)
                .map((item) => (
                  <div key={item.id} className="repo-card repo-card--compact">
                    <div className="section-stack--tight">
                      <strong>{item.gitea_project_path ?? item.gitea_repo_url}</strong>
                      {item.tomorrow_audit_text ? <p>Audits: {item.tomorrow_audit_text}</p> : null}
                      <p>Question work: {questionWorkStatus(item.latestAnalysisStatus)}</p>
                    </div>
                    <Button type="button" onClick={() => selectRepository(item)}>
                      Switch
                    </Button>
                  </div>
                ))}
            </div>
          </section>
        </Card>
      ) : null}
      {repository.latestAnalysisJobId ? (
        <Card>
          <section className="section-stack">
            <h2>Latest question work</h2>
            <p className="section-lede">A previous question-work job already exists for this repository.</p>
            <Button type="button" onClick={() => navigate(`/analysis/${repository.latestAnalysisJobId}`)}>
              Open question work
            </Button>
          </section>
        </Card>
      ) : null}
    </section>
  )
}
