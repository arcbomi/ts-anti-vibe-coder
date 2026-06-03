import { useParams } from 'react-router-dom'

import { AnalysisProgressSection } from '@/domains/analysis/pageSection/AnalysisProgressSection'

export function AnalysisPage() {
  const { jobId } = useParams()

  return <AnalysisProgressSection jobId={jobId} />
}
