import { Card } from '@/shared/components/Card'

type BotInstructionCardProps = {
  botUsername: string
}

export function BotInstructionCard({ botUsername }: BotInstructionCardProps) {
  return (
    <Card>
      <div className="section-stack">
        <h2>Add the GitLab userbot</h2>
        <span className="sr-only">add the gitlab-server-userbot</span>
        <p>Please add our GitLab server userbot as a collaborator to your repository.</p>
        <p>After you add it, click "I already added the bot."</p>
        <p>
          Userbot username: <code>{botUsername}</code>
        </p>
      </div>
    </Card>
  )
}
