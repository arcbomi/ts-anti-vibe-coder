import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

import { questionApi } from '@/domains/question/api/questionApi'
import { questionStore } from '@/domains/question/store/questionStore'
import { QuestionListSection } from '@/domains/question/pageSection/QuestionListSection'
import { examStore } from '@/domains/exam/store/examStore'
import { examApi } from '@/domains/exam/api/examApi'
import { SubmitExamButton } from '@/domains/exam/components/SubmitExamButton'
import { LoadingState } from '@/shared/components/LoadingState'
import { ErrorState } from '@/shared/components/ErrorState'

export function ExamTakingSection() {
  const { examId } = useParams()
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!examId) return
    let stopped = false
    const run = async () => {
      try {
        const resp = await questionApi.listForExam(examId)
        if (!stopped) questionStore.getState().setQuestions(resp.questions)
      } catch (caughtError: unknown) {
        const message = caughtError instanceof Error ? caughtError.message : 'Failed to load questions'
        if (!stopped) setError(message)
      } finally {
        if (!stopped) setLoading(false)
      }
    }
    void run()
    return () => {
      stopped = true
    }
  }, [examId])

  if (!examId) return <ErrorState message="Missing examId" />
  if (error) return <ErrorState message={error} />
  if (loading) return <LoadingState label="Loading exam..." />

  return (
    <div>
      <h1>Exam</h1>
      <QuestionListSection onAnswer={(id, opt) => examStore.getState().setAnswer(id, opt)} />
      <SubmitExamButton
        onClick={async () => {
          const answers = Object.values(examStore.getState().answers)
          await examApi.submit(examId, answers)
          nav(`/exam/${examId}/result`)
        }}
      />
    </div>
  )
}
