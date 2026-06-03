import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ExamQuestion } from '@/domains/exam/components/ExamQuestion'
import { SubmitExamButton } from '@/domains/exam/components/SubmitExamButton'
import { useExam } from '@/domains/exam/hooks/useExam'
import { useExamTimer } from '@/domains/exam/hooks/useExamTimer'
import { Card } from '@/shared/components/Card'
import { ErrorState } from '@/shared/components/ErrorState'
import { LoadingState } from '@/shared/components/LoadingState'

const DEFAULT_EXAM_DURATION_SECONDS = 60 * 60

interface ExamTakingSectionProps {
  examId?: string
}

export function ExamTakingSection({ examId: examIdProp }: ExamTakingSectionProps) {
  const params = useParams()
  const navigate = useNavigate()
  const examId = examIdProp ?? params.examId
  const { exam, selectedAnswers, result, isLoading, isSubmitting, error, loadExam, selectAnswer, submitExam } = useExam(examId)
  const { formattedTime, isExpired } = useExamTimer(DEFAULT_EXAM_DURATION_SECONDS)

  useEffect(() => {
    void loadExam()
  }, [loadExam])

  if (!examId) return <ErrorState message="Missing exam id." />
  if (isLoading && !exam) return <LoadingState label="Loading exam..." />
  if (error && !exam) return <ErrorState message={error} />
  if (!exam) return <LoadingState label="Preparing exam..." />

  const totalCount = exam.questions.length
  const answeredCount = Object.keys(selectedAnswers).filter((questionId) =>
    exam.questions.some((question) => question.id === questionId),
  ).length
  const allQuestionsAnswered = totalCount > 0 && answeredCount === totalCount

  async function handleSubmit() {
    const submittedResult = await submitExam()
    if (submittedResult) {
      navigate(`/exam/${examId}/result`)
    }
  }

  return (
    <section style={{ display: 'grid', gap: '1.5rem', maxWidth: '56rem', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ display: 'grid', gap: '0.75rem' }}>
        <p style={{ margin: 0, color: '#2563eb', fontWeight: 700 }}>Repository Understanding Exam</p>
        <h1 style={{ margin: 0 }}>Answer the English-only A/B/C/D questions</h1>
        <p style={{ margin: 0, color: '#4b5563' }}>
          Select one answer per question. The backend grades the exam after submission; this screen does not know or
          display correct answers.
        </p>
      </header>

      <Card>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            justifyContent: 'space-between',
            padding: '1rem',
            border: '1px solid #e5e7eb',
            borderRadius: '1rem',
            background: '#f9fafb',
          }}
        >
          <strong>Time remaining: {formattedTime}</strong>
          <span>
            {answeredCount} / {totalCount} answered
          </span>
          {isExpired ? <span style={{ color: '#b91c1c' }}>Timer expired. Submit when ready.</span> : null}
        </div>
      </Card>

      {error ? <ErrorState message={error} /> : null}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {exam.questions.map((question, index) => (
          <ExamQuestion
            key={question.id}
            index={index}
            question={question}
            selectedOption={selectedAnswers[question.id]}
            disabled={isSubmitting}
            onSelect={selectAnswer}
          />
        ))}
      </div>

      <Card>
        <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '1rem', background: '#ffffff' }}>
          <SubmitExamButton
            answeredCount={answeredCount}
            totalCount={totalCount}
            disabled={!allQuestionsAnswered}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />
          {!allQuestionsAnswered ? (
            <p style={{ marginBottom: 0, color: '#6b7280' }}>Answer every question before submitting.</p>
          ) : null}
        </div>
      </Card>

      {result ? (
        <Card>
          <div style={{ padding: '1rem', border: '1px solid #d1fae5', borderRadius: '1rem', background: '#ecfdf5' }}>
            Backend grading complete. Result status: <strong>{result.status}</strong>.
          </div>
        </Card>
      ) : null}
    </section>
  )
}
