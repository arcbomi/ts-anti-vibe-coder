import type { Question } from '@/domains/question/types/question.types'
import { ExamOption } from '@/domains/exam/components/ExamOption'

export function ExamQuestion({ q, onSelect }: { q: Question; onSelect: (opt: 'A' | 'B' | 'C' | 'D') => void }) {
  return (
    <div>
      <div>{q.question}</div>
      <ExamOption label={`A. ${q.options.A}`} onSelect={() => onSelect('A')} />
      <ExamOption label={`B. ${q.options.B}`} onSelect={() => onSelect('B')} />
      <ExamOption label={`C. ${q.options.C}`} onSelect={() => onSelect('C')} />
      <ExamOption label={`D. ${q.options.D}`} onSelect={() => onSelect('D')} />
    </div>
  )
}
