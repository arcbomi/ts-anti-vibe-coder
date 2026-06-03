import { Card } from '@/shared/components/Card'

type BotInstructionCardProps = {
  botUsername: string
}

export function BotInstructionCard({ botUsername }: BotInstructionCardProps) {
  return (
    <Card>
      <h2>Add the GitLab userbot</h2>
      <p>Please add our GitLab server userbot as a collaborator to your repository.</p>
      <p>After you add it, click "I already added the bot."</p>
      <p>
        Userbot username: <code>{botUsername}</code>
      </p>
    </Card>
  )
}
