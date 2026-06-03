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
    <article
      style={{
        display: 'grid',
        gap: '1rem',
        padding: '1.25rem',
        border: '1px solid #e5e7eb',
        borderRadius: '1rem',
        background: '#ffffff',
      }}
    >
      <header style={{ display: 'grid', gap: '0.35rem' }}>
        <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Question {index + 1}</span>
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{question.question}</h2>
      </header>

      <div role="radiogroup" aria-label={`Question ${index + 1} options`} style={{ display: 'grid', gap: '0.75rem' }}>
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
