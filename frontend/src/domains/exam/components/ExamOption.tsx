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
      aria-pressed={selected}
      onClick={() => onSelect(optionKey)}
      style={{
        width: '100%',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
        padding: '0.75rem 1rem',
        border: selected ? '2px solid #2563eb' : '1px solid #d1d5db',
        borderRadius: '0.75rem',
        background: selected ? '#eff6ff' : '#ffffff',
        color: '#111827',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
      }}
    >
      <strong aria-hidden="true">{optionKey}</strong>
      <span>{text}</span>
    </Button>
  )
}
