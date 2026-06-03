import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

import { useExam } from '@/domains/exam/hooks/useExam'
import { Card } from '@/shared/components/Card'
import { ErrorState } from '@/shared/components/ErrorState'
import { LoadingState } from '@/shared/components/LoadingState'

interface ExamResultSectionProps {
  examId?: string
}

export function ExamResultSection({ examId: examIdProp }: ExamResultSectionProps) {
  const params = useParams()
  const examId = examIdProp ?? params.examId
  const { result, isLoading, error, loadResult } = useExam(examId)

  useEffect(() => {
    void loadResult()
  }, [loadResult])

  if (!examId) return <ErrorState message="Missing exam id." />
  if (isLoading && !result) return <LoadingState label="Loading exam result..." />
  if (error && !result) return <ErrorState message={error} />
  if (!result) return <LoadingState label="Preparing exam result..." />

  return (
    <section style={{ display: 'grid', gap: '1.5rem', maxWidth: '48rem', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ display: 'grid', gap: '0.75rem' }}>
        <p style={{ margin: 0, color: result.passed ? '#047857' : '#b91c1c', fontWeight: 700 }}>
          {result.passed
            ? 'Passed — you demonstrated understanding of this repository.'
            : 'Failed — review the repository and try again later.'}
        </p>
        <h1 style={{ margin: 0 }}>Exam result</h1>
      </header>

      {error ? <ErrorState message={error} /> : null}

      <Card>
        <div
          style={{
            display: 'grid',
            gap: '1rem',
            padding: '1.25rem',
            border: '1px solid #e5e7eb',
            borderRadius: '1rem',
            background: '#ffffff',
          }}
        >
          <div>
            <span style={{ color: '#6b7280' }}>Score</span>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{result.score}</div>
          </div>
          <div>
            <span style={{ color: '#6b7280' }}>Correct answers</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              {result.correctCount} / {result.totalQuestions}
            </div>
          </div>
          <div>
            <span style={{ color: '#6b7280' }}>Passing score</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{result.passingScore}</div>
          </div>
          <div>
            <span style={{ color: '#6b7280' }}>Status</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, textTransform: 'capitalize' }}>{result.status}</div>
          </div>
        </div>
      </Card>
    </section>
  )
}
