import { Card } from '@/shared/components/Card'

export function BotInstructionCard({ botUsername }: { botUsername: string }) {
  return (
    <Card>
      <div>Please add our GitLab server userbot as a collaborator to your repository.</div>
      <div>Bot account: {botUsername}</div>
    </Card>
  )
}
