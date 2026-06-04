import { Link } from 'react-router-dom'

import { useRepositories } from '@/domains/repository/hooks/useRepositories'
import { Card } from '@/shared/components/Card'

function questionWorkLabel(status?: string | null) {
  switch (status) {
    case 'pending':
      return 'Queued'
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
      return 'Question work failed'
    default:
      return 'Not started'
  }
}

export function RepositoryOverviewSection() {
  const { repositories, repository } = useRepositories()

  return (
    <Card>
      <section className="section-stack">
        <h2>Your repositories</h2>
        {repositories.length > 0 ? (
          <>
            <p className="section-lede">
              Pick the repository you want to verify. The bot only reads code after you add it as a collaborator.
            </p>
            <div className="section-stack--tight">
              {repositories.slice(0, 3).map((item) => (
                <div key={item.id} className="repo-summary-row">
                  <div>
                    <strong>{item.gitea_repo_url}</strong>
                    <p>Question work: {questionWorkLabel(item.latestAnalysisStatus)}</p>
                  </div>
                  <Link to={repository?.id === item.id ? '/repository/status' : '/repository/connect'}>
                    {repository?.id === item.id ? 'Open status' : 'Choose repo'}
                  </Link>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="section-lede">Choose a repository to test, or add one if it is not in your list yet.</p>
            <p>
              <Link to="/repository/connect">Choose a repository</Link>
            </p>
          </>
        )}
      </section>
    </Card>
  )
}
