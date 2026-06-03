import type { AnalysisJobStatus } from '@/domains/analysis/types/analysis.types'

export function AnalysisProgress({ status }: { status: AnalysisJobStatus }) {
  return <div>Status: {status}</div>
}
