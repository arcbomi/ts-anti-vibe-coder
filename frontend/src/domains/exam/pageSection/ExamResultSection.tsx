import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

import { useExam } from '@/domains/exam/hooks/useExam'
import { Card } from '@/shared/components/Card'
import { ErrorState } from '@/shared/components/ErrorState'
import { LoadingState } from '@/shared/components/LoadingState'

interface ExamResultSectionProps {
  examId?: string
}

function formatProjectName(projectSlug?: string) {
  if (!projectSlug) return 'Selected project'

  return projectSlug
    .split('/')
    .at(-1)
    ?.split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Selected project'
}

export function ExamResultSection({ examId: examIdProp }: ExamResultSectionProps) {
  const params = useParams()
  const examId = examIdProp ?? params.examId
  const { exam, result, isLoading, error, loadResult } = useExam(examId)

  useEffect(() => {
    void loadResult()
  }, [loadResult])

  if (!examId) return <ErrorState message="Missing exam id." />
  if (isLoading && !result) return <LoadingState label="Loading exam result..." />
  if (error && !result) return <ErrorState message={error} />
  if (!result) return <LoadingState label="Preparing exam result..." />

  const projectName = exam?.projectName ?? formatProjectName(result.projectSlug || exam?.projectSlug)

  return (
    <section className="page-shell section-stack">
      <header className="section-stack">
        <p className={result.passed ? 'eyebrow eyebrow--success' : 'eyebrow eyebrow--danger'}>
          {result.passed
            ? 'Passed — you demonstrated understanding of this repository.'
            : 'Failed — review the repository and try again later.'}
        </p>
        <h1>Exam result</h1>
        <p className="section-lede">{projectName}</p>
      </header>

      {error ? <ErrorState message={error} /> : null}

      <Card>
        <div className="metric-grid">
          <div className="metric">
            <span className="metric__label">Score</span>
            <div className="metric__value metric__value--large">{result.score}</div>
          </div>
          <div className="metric">
            <span className="metric__label">Correct answers</span>
            <div className="metric__value">
              {result.correctCount} / {result.totalQuestions}
            </div>
          </div>
          <div className="metric">
            <span className="metric__label">Passing score</span>
            <div className="metric__value">{result.passingScore}</div>
          </div>
          <div className="metric">
            <span className="metric__label">Status</span>
            <div className="metric__value metric__value--caps">{result.status}</div>
          </div>
        </div>
      </Card>
    </section>
  )
}
