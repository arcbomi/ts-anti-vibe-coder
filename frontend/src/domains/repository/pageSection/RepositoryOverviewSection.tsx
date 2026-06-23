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
                    <strong>{item.gitea_project_path ?? item.gitea_repo_url}</strong>
                    {item.tomorrow_audit_text ? <p>Audits: {item.tomorrow_audit_text}</p> : null}
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
            <p className="section-lede">Refresh your succeeded Tomorrow projects before choosing a repository to test.</p>
            <p>
              <Link to="/repository/connect">Refresh from Tomorrow</Link>
            </p>
          </>
        )}
      </section>
    </Card>
  )
}
