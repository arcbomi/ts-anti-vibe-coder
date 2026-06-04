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

export function RepositoryStatusSectionContent({ showInstructionCard = true }: RepositoryStatusSectionContentProps) {
  const navigate = useNavigate()
  const { repository, error, isCheckingBotAccess, isStartingAnalysis, startAnalysis } = useRepositories()
  const { checkBotAccess } = useBotAccessCheck()
  const botUsername = import.meta.env.VITE_GITLAB_BOT_USERNAME ?? 'gitlab-server-userbot'

  if (!repository) {
    return (
      <Card>
        <section className="section-stack">
          <h1>Repository access status</h1>
          <p className="section-lede">No repository is loaded yet. Start by submitting a GitLab repository URL.</p>
          <p>
            <Link to="/repository/connect">Go to repository connection</Link>
          </p>
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
        Confirm collaborator access before starting analysis. Repository reading and AI analysis stay blocked until
        the backend reports access is granted.
      </p>
      {showInstructionCard ? <BotInstructionCard botUsername={botUsername} /> : null}
      <Card>
        <section className="section-stack">
          <p className="section-lede">
            Repository: <code>{repository.gitlab_repo_url}</code>
          </p>
          <BotAccessStatus status={repository.bot_access_status} />
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
              {isStartingAnalysis ? 'Starting analysis...' : 'Start AI analysis'}
            </Button>
          </div>
        </section>
      </Card>
      {repository.latestAnalysisJobId ? (
        <Card>
          <section className="section-stack">
            <h2>Latest analysis job</h2>
            <p className="section-lede">A previous analysis job exists for this repository.</p>
            <Button type="button" onClick={() => navigate(`/analysis/${repository.latestAnalysisJobId}`)}>
              Open analysis progress
            </Button>
          </section>
        </Card>
      ) : null}
    </section>
  )
}
