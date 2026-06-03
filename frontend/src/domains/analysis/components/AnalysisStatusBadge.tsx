import type { AnalysisJobStatus } from '@/domains/analysis/types/analysis.types'

export function AnalysisStatusBadge({ status }: { status: AnalysisJobStatus }) {
  return <span>{status}</span>
}
