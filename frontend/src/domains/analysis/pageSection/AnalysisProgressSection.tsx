import { useParams } from 'react-router-dom'

import { AnalysisProgress } from '@/domains/analysis/components/AnalysisProgress'
import { useAnalysisJob } from '@/domains/analysis/hooks/useAnalysisJob'
import { ErrorState } from '@/shared/components/ErrorState'
import { LoadingState } from '@/shared/components/LoadingState'

type AnalysisProgressSectionProps = {
  jobId?: string
}

export function AnalysisProgressSection({ jobId: jobIdProp }: AnalysisProgressSectionProps) {
  const params = useParams()
  const jobId = jobIdProp ?? params.jobId
  const { job, isLoading, error } = useAnalysisJob(jobId)

  if (error && !job) return <ErrorState message={error} />
  if (isLoading && !job) return <LoadingState label="Loading analysis job..." />
  if (!job) return <LoadingState label="Waiting for analysis job..." />

  return (
    <section className="section-stack">
      <h1>AI Analysis Progress</h1>
      <p className="section-lede">The backend is checking repository access, reading code, and generating the question set.</p>
      {error && <ErrorState message={error} />}
      <AnalysisProgress job={job} />
      {job.status === 'completed' && (
        <div className="callout callout--success">
          <h2>Analysis completed.</h2>
          <p>20 English-only exam questions are ready.</p>
          <p>You can now wait for the Friday offline exam.</p>
        </div>
      )}
    </section>
  )
}
