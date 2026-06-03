import type { Question } from '@/domains/question/types/question.types'
import { OptionButton } from '@/domains/question/components/OptionButton'

export function QuestionCard({ q, onSelect }: { q: Question; onSelect: (opt: 'A' | 'B' | 'C' | 'D') => void }) {
  return (
    <div>
      <div>{q.question}</div>
      <div>
        <OptionButton label={`A. ${q.options.A}`} onClick={() => onSelect('A')} />
        <OptionButton label={`B. ${q.options.B}`} onClick={() => onSelect('B')} />
        <OptionButton label={`C. ${q.options.C}`} onClick={() => onSelect('C')} />
        <OptionButton label={`D. ${q.options.D}`} onClick={() => onSelect('D')} />
      </div>
    </div>
  )
}
