import { ExamOption } from '@/domains/exam/components/ExamOption'
import type { ExamOptionKey, ExamQuestion as ExamQuestionType } from '@/domains/exam/types/exam.types'

interface ExamQuestionProps {
  index: number
  question: ExamQuestionType
  selectedOption?: ExamOptionKey
  disabled?: boolean
  onSelect: (questionId: string, option: ExamOptionKey) => void
}

export function ExamQuestion({ index, question, selectedOption, disabled = false, onSelect }: ExamQuestionProps) {
  return (
    <article className="card card--flat section-stack">
      <header className="section-stack section-stack--tight">
        <span className="eyebrow">Question {index + 1}</span>
        <h2 className="question-title">{question.question}</h2>
      </header>

      <div role="radiogroup" aria-label={`Question ${index + 1} options`} className="question-options">
        {question.options.map((option) => (
          <ExamOption
            key={option.key}
            optionKey={option.key}
            text={option.text}
            selected={selectedOption === option.key}
            disabled={disabled}
            onSelect={(selected) => onSelect(question.id, selected)}
          />
        ))}
      </div>
    </article>
  )
}
