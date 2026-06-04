import { Link } from 'react-router-dom'

import { useRepositories } from '@/domains/repository/hooks/useRepositories'
import { Card } from '@/shared/components/Card'

export function RepositoryOverviewSection() {
  const { repository } = useRepositories()

  return (
    <Card>
      <section className="section-stack">
        <h2>Repository verification flow</h2>
        {repository ? (
          <>
            <p className="section-lede">
              Current repository: <code>{repository.gitlab_repo_url}</code>
            </p>
            <p>
              Bot access status: <strong>{repository.bot_access_status}</strong>
            </p>
            <p>
              <Link to="/repository/status">Continue the repository access flow</Link>
            </p>
          </>
        ) : (
          <>
            <p className="section-lede">
              Start by submitting the GitLab repository URL. You do not need to upload code or share a personal token.
            </p>
            <p>
              <Link to="/repository/connect">Connect a repository</Link>
            </p>
          </>
        )}
      </section>
    </Card>
  )
}
