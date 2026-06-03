import { useParams } from 'react-router-dom'
import { LoadingState } from '@/shared/components/LoadingState'
import { ErrorState } from '@/shared/components/ErrorState'
import { AnalysisProgress } from '@/domains/analysis/components/AnalysisProgress'
import { useAnalysisJob } from '@/domains/analysis/hooks/useAnalysisJob'

export function AnalysisProgressSection() {
  const { jobId } = useParams()
  if (!jobId) return <ErrorState message="Missing jobId" />

  const { job, error } = useAnalysisJob(jobId)
  if (error) return <ErrorState message={error} />
  if (!job) return <LoadingState label="Loading analysis job..." />

  return (
    <div>
      <h1>Analysis</h1>
      <AnalysisProgress status={job.status} />
    </div>
  )
}
