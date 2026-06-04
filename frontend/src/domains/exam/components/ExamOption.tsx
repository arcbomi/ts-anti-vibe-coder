import { Button } from '@/shared/components/Button'
import type { ExamOptionKey } from '@/domains/exam/types/exam.types'

interface ExamOptionProps {
  optionKey: ExamOptionKey
  text: string
  selected: boolean
  disabled?: boolean
  onSelect: (option: ExamOptionKey) => void
}

export function ExamOption({ optionKey, text, selected, disabled = false, onSelect }: ExamOptionProps) {
  return (
    <Button
      type="button"
      disabled={disabled}
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(optionKey)}
      className={selected ? 'exam-option exam-option--selected' : 'exam-option'}
    >
      <strong aria-hidden="true">{optionKey}</strong>
      <span>{text}</span>
    </Button>
  )
}
