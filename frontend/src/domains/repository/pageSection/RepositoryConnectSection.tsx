import { useNavigate } from 'react-router-dom'

import { RepoUrlInput } from '@/domains/repository/components/RepoUrlInput'
import { BotInstructionCard } from '@/domains/repository/components/BotInstructionCard'
import { repositoryApi } from '@/domains/repository/api/repositoryApi'
import { repositoryStore } from '@/domains/repository/store/repositoryStore'

export function RepositoryConnectSection() {
  const nav = useNavigate()
  const botUsername = import.meta.env.VITE_GITLAB_BOT_USERNAME ?? 'gitlab-bot'

  return (
    <div>
      <h1>Connect Repository</h1>
      <RepoUrlInput
        onSubmit={async (gitlabRepoUrl) => {
          const repo = await repositoryApi.create({ gitlabRepoUrl })
          repositoryStore.getState().setRepository(repo)
        }}
      />
      <BotInstructionCard botUsername={botUsername} />
      <button type="button" onClick={() => nav('/repository/status')}>
        I already added the bot
      </button>
    </div>
  )
}
