import type { BotAccessStatus as Status } from '@/domains/repository/types/repository.types'

export function BotAccessStatus({ status }: { status: Status }) {
  return <div>Bot access: {status}</div>
}
