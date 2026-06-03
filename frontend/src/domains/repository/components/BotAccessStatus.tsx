import type { BotAccessStatus as Status } from '@/domains/repository/types/repository.types'

const statusLabels: Record<Status, string> = {
  pending: 'Waiting for you to add the GitLab userbot as a collaborator.',
  checking: 'Checking whether the GitLab userbot can access this repository...',
  granted: 'Bot access confirmed. You can start AI analysis now.',
  denied: 'Bot access denied. Please make sure you added the correct GitLab userbot as a collaborator.',
  failed: 'Bot access denied. Please make sure you added the correct GitLab userbot as a collaborator.',
}

export function BotAccessStatus({ status }: { status: Status }) {
  return <p aria-live="polite">{statusLabels[status]}</p>
}
