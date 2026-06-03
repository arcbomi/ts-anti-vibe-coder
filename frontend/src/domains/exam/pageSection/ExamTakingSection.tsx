import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'

import { QuestionListSection } from '@/domains/question/pageSection/QuestionListSection'
import { useQuestions } from '@/domains/question/hooks/useQuestions'
import type { OptionKey } from '@/domains/question/types/question.types'
import { examStore } from '@/domains/exam/store/examStore'
import { examApi } from '@/domains/exam/api/examApi'
import { SubmitExamButton } from '@/domains/exam/components/SubmitExamButton'
import { LoadingState } from '@/shared/components/LoadingState'
import { ErrorState } from '@/shared/components/ErrorState'

export function ExamTakingSection() {
  const { examId } = useParams()
  const nav = useNavigate()
  const { questions, loading, error } = useQuestions(examId)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, OptionKey>>({})

  if (!examId) return <ErrorState message="Missing examId" />
  if (error) return <ErrorState message={error} />
  if (loading) return <LoadingState label="Loading exam..." />

  return (
    <div>
      <h1>Exam</h1>
      <QuestionListSection
        questions={questions}
        selectedAnswers={selectedAnswers}
        onSelectAnswer={(id, opt) => {
          setSelectedAnswers((answers) => ({ ...answers, [id]: opt }))
          examStore.getState().setAnswer(id, opt)
        }}
      />
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
