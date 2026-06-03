import { useNavigate } from 'react-router-dom'
import { BotAccessStatus } from '@/domains/repository/components/BotAccessStatus'
import { useBotAccessCheck } from '@/domains/repository/hooks/useBotAccessCheck'
import { useRepositories } from '@/domains/repository/hooks/useRepositories'
import { Button } from '@/shared/components/Button'
import { ErrorState } from '@/shared/components/ErrorState'
import { LoadingState } from '@/shared/components/LoadingState'

export function RepositoryStatusSection() {
  const navigate = useNavigate()
  const { repository, error, isCheckingBotAccess, isStartingAnalysis, startAnalysis } = useRepositories()
  const { checkBotAccess } = useBotAccessCheck()

  if (!repository) {
    return <p>Enter a GitLab repository URL to begin.</p>
  }

  const isAccessGranted = repository.bot_access_status === 'granted'

  return (
    <section>
      <h2>Repository access status</h2>
      <p>
        Repository: <code>{repository.gitlab_repo_url}</code>
      </p>
      <BotAccessStatus status={repository.bot_access_status} />
      {error && <ErrorState message={error} />}
      {isCheckingBotAccess && <LoadingState label="Checking bot access..." />}
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
    </section>
  )
}
