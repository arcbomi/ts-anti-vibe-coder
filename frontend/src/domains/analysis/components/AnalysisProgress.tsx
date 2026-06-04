import { AnalysisStatusBadge } from '@/domains/analysis/components/AnalysisStatusBadge'
import type { AnalysisJob } from '@/domains/analysis/types/analysis.types'

const statusMessages: Record<AnalysisJob['status'], string> = {
  pending: 'Analysis job is waiting to start.',
  checking_bot_access: 'Checking whether the Gitea userbot can access the repository.',
  reading_repository: 'Reading repository files from Gitea.',
  indexing_code: 'Indexing important source files.',
  analyzing_code: 'AI is analyzing how the program works.',
  generating_questions: 'AI is generating 20 English-only exam questions.',
  saving_questions: 'Saving generated questions.',
  completed: 'Analysis completed. Questions are ready for the exam.',
  failed: 'Analysis failed. Please check the error message.',
}

const activeStatuses: AnalysisJob['status'][] = [
  'pending',
  'checking_bot_access',
  'reading_repository',
  'indexing_code',
  'analyzing_code',
  'generating_questions',
  'saving_questions',
]

type AnalysisProgressProps = {
  job: AnalysisJob
}

export function AnalysisProgress({ job }: AnalysisProgressProps) {
  const isActive = activeStatuses.includes(job.status)
  const isFailed = job.status === 'failed'

  return (
    <div aria-live="polite">
      <p>
        Status: <AnalysisStatusBadge status={job.status} />
      </p>
      <p>{job.progressMessage ?? statusMessages[job.status]}</p>
      {job.status === 'analyzing_code' && (
        <p>
          This may include routes, handlers, services, database access, frontend pages, hooks,
          stores, and important program behavior.
        </p>
      )}
      {isActive && <progress aria-label="Analysis is in progress" />}
      {isFailed && (
        <p role="alert">
          {job.errorMessage ??
            'The Gitea userbot may not have access, or the repository could not be read.'}
        </p>
      )}
    </div>
  )
}
