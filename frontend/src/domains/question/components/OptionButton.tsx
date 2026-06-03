import { Button } from '@/shared/components/Button'
import type { OptionKey } from '@/domains/question/types/question.types'

export interface OptionButtonProps {
  optionKey: OptionKey
  text: string
  selected: boolean
  disabled?: boolean
  onSelect: (option: OptionKey) => void
}

export function OptionButton({ optionKey, text, selected, disabled = false, onSelect }: OptionButtonProps) {
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
        padding: '0.875rem 1rem',
        borderRadius: '12px',
        border: selected ? '1px solid var(--accent-border)' : '1px solid var(--border)',
        background: selected ? 'var(--accent-bg)' : 'transparent',
        color: 'var(--text-h)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <strong aria-hidden="true">{optionKey}</strong>
      <span>{text}</span>
    </Button>
  )
}
