import { QuestionCard } from '@/domains/question/components/QuestionCard'
import type { ExamQuestion, OptionKey } from '@/domains/question/types/question.types'

export interface QuestionListSectionProps {
  questions: ExamQuestion[]
  selectedAnswers: Record<string, OptionKey>
  disabled?: boolean
  onSelectAnswer: (questionId: string, option: OptionKey) => void
}

export function QuestionListSection({
  questions,
  selectedAnswers,
  disabled = false,
  onSelectAnswer,
}: QuestionListSectionProps) {
  if (questions.length === 0) {
    return (
      <section aria-label="Questions" style={{ padding: '2rem 0' }}>
        <p>No questions are available yet.</p>
      </section>
    )
  }

  return (
    <section aria-label="Questions" style={{ display: 'grid', gap: '1rem' }}>
      {questions.map((question, index) => (
        <QuestionCard
          key={question.id}
          question={question}
          selectedOption={selectedAnswers[question.id]}
          disabled={disabled}
          questionIndex={index}
          onSelect={onSelectAnswer}
        />
      ))}
    </section>
  )
}
