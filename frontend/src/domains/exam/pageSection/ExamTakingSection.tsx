import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { ExamQuestion } from '@/domains/exam/components/ExamQuestion'
import { SubmitExamButton } from '@/domains/exam/components/SubmitExamButton'
import { useExam } from '@/domains/exam/hooks/useExam'
import { Card } from '@/shared/components/Card'
import { ErrorState } from '@/shared/components/ErrorState'
import { LoadingState } from '@/shared/components/LoadingState'

interface ExamTakingSectionProps {
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

function isSubmittedStatus(status?: string) {
  return status === 'submitted' || status === 'passed' || status === 'failed'
}

export function ExamTakingSection({ examId: examIdProp }: ExamTakingSectionProps) {
  const params = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const examId = examIdProp ?? params.examId
  const [missingAnswersError, setMissingAnswersError] = useState<string | null>(null)
  const {
    exam,
    selectedAnswers,
    isLoading,
    isSubmitting,
    error,
    loadExam,
    selectAnswer,
    submitExam,
  } = useExam(examId)

  useEffect(() => {
    void loadExam()
  }, [loadExam])

  useEffect(() => {
    if (examId && exam && isSubmittedStatus(exam.status)) {
      navigate(`/exam/${examId}/result`, { replace: true })
    }
  }, [exam, examId, navigate])

  if (!examId) return <ErrorState message="Missing exam id." />
  if (isLoading && !exam) return <LoadingState label="Loading exam..." />
  if (error && !exam) return <ErrorState message={error} />
  if (!exam) return <LoadingState label="Loading exam..." />

  const totalCount = exam.questions.length
  const answeredCount = exam.questions.reduce(
    (count, question) => (selectedAnswers[question.id] ? count + 1 : count),
    0,
  )
  const missingCount = Math.max(totalCount - answeredCount, 0)
  const allQuestionsAnswered = totalCount === 20 && missingCount === 0
  const projectName =
    exam.projectName ||
    ((location.state as { projectName?: string } | null)?.projectName ?? undefined) ||
    formatProjectName(exam.projectSlug)

  async function handleSubmit() {
    if (!allQuestionsAnswered) {
      setMissingAnswersError(`Answer all 20 questions before submitting. ${missingCount} remaining.`)
      return
    }

    setMissingAnswersError(null)
    const submittedResult = await submitExam()
    if (submittedResult?.submitted) {
      navigate(`/exam/${examId}/result`, { replace: true })
    }
  }

  function handleSelect(questionId: string, option: 'A' | 'B' | 'C' | 'D') {
    if (missingAnswersError) {
      setMissingAnswersError(null)
    }
    selectAnswer(questionId, option)
  }

  return (
    <section className="page-shell section-stack">
      <header className="exam-hero">
        <div className="section-stack">
          <p className="eyebrow">Project Exam</p>
          <h1>{projectName}</h1>
          <p className="section-lede">
            Answer all 20 questions before you submit. Grading details remain hidden until the backend processes your
            final submission.
          </p>
        </div>
        <div className="exam-progress" aria-live="polite">
          <strong>{answeredCount}</strong>
          <span>of 20 answered</span>
          <div className="exam-progress__track" aria-hidden="true">
            <span style={{ width: `${(answeredCount / 20) * 100}%` }} />
          </div>
        </div>
      </header>

      <Card>
        <div className="exam-summary">
          <div className="exam-summary__item">
            <span className="metric__label">Project</span>
            <strong>{projectName}</strong>
          </div>
          <div className="exam-summary__item">
            <span className="metric__label">Questions</span>
            <strong>{totalCount} / 20 loaded</strong>
          </div>
          <div className="exam-summary__item">
            <span className="metric__label">Progress</span>
            <strong>
              {answeredCount} / 20 answered
            </strong>
          </div>
        </div>
      </Card>

      {error ? <ErrorState message={error} /> : null}

      {totalCount !== 20 ? (
        <ErrorState message="This exam is not ready yet. Expected 20 questions before answering can begin." />
      ) : null}

      {missingAnswersError ? <ErrorState message={missingAnswersError} /> : null}

      <div className="question-stack">
        {exam.questions.map((question, index) => (
          <ExamQuestion
            key={question.id}
            index={index}
            question={question}
            selectedOption={selectedAnswers[question.id]}
            disabled={isSubmitting || isSubmittedStatus(exam.status)}
            onSelect={handleSelect}
          />
        ))}
      </div>

      <Card className="exam-submit-card">
        <div className="section-stack">
          <div className="callout callout--danger">
            Submission is final. You can submit this exam only once.
          </div>

          <SubmitExamButton
            answeredCount={answeredCount}
            totalCount={20}
            disabled={totalCount !== 20}
            submitted={isSubmittedStatus(exam.status)}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />

          {!allQuestionsAnswered && totalCount === 20 ? (
            <p className="field-hint">Some answers are still missing. Finish every question before submitting.</p>
          ) : null}
        </div>
      </Card>
    </section>
  )
}
