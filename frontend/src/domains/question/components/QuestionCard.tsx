import { OptionButton } from '@/domains/question/components/OptionButton'
import type { ExamQuestion, OptionKey } from '@/domains/question/types/question.types'
import { Card } from '@/shared/components/Card'

const optionKeys: OptionKey[] = ['A', 'B', 'C', 'D']

export interface QuestionCardProps {
  question: ExamQuestion
  selectedOption?: OptionKey
  disabled?: boolean
  questionIndex?: number
  onSelect: (questionId: string, option: OptionKey) => void
}

export function QuestionCard({ question, selectedOption, disabled = false, questionIndex, onSelect }: QuestionCardProps) {
  return (
    <Card>
      <article
        aria-labelledby={`question-${question.id}`}
        style={{
          padding: '1.25rem',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          textAlign: 'left',
        }}
      >
        {questionIndex !== undefined && (
          <p style={{ marginBottom: '0.5rem', color: 'var(--accent)', fontWeight: 700 }}>Question {questionIndex + 1}</p>
        )}

        <h2 id={`question-${question.id}`} style={{ marginBottom: '1rem' }}>
          {question.question}
        </h2>

        {question.sourceFilePath && (
          <p style={{ marginBottom: '1rem' }}>
            <code>{question.sourceFilePath}</code>
          </p>
        )}

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {optionKeys.map((optionKey) => (
            <OptionButton
              key={optionKey}
              optionKey={optionKey}
              text={question.options[optionKey]}
              selected={selectedOption === optionKey}
              disabled={disabled}
              onSelect={(option) => onSelect(question.id, option)}
            />
          ))}
        </div>
      </article>
    </Card>
  )
}
