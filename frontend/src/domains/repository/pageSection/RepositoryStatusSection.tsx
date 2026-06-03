import { useNavigate } from 'react-router-dom'
import { BotAccessStatus } from '@/domains/repository/components/BotAccessStatus'
import { useRepositories } from '@/domains/repository/hooks/useRepositories'
import { useBotAccessCheck } from '@/domains/repository/hooks/useBotAccessCheck'
import { repositoryApi } from '@/domains/repository/api/repositoryApi'

export function RepositoryStatusSection() {
  const nav = useNavigate()
  const { repository, botAccess } = useRepositories()
  const { check } = useBotAccessCheck()

  return (
    <div>
      <h1>Repository Status</h1>
      <div>Repository: {repository?.gitlabRepoUrl ?? 'none'}</div>
      <BotAccessStatus status={botAccess} />
      <button type="button" onClick={() => check()}>
        Check bot access
      </button>
      <button
        type="button"
        disabled={!repository || botAccess !== 'granted'}
        onClick={async () => {
          if (!repository) return
          const { jobId } = await repositoryApi.startAnalysis(repository.id)
          nav(`/analysis/${jobId}`)
        }}
      >
        Start analysis
      </button>
    </div>
  )
}
