import { Button } from '@/shared/components/Button'

interface SubmitExamButtonProps {
  disabled?: boolean
  isSubmitting?: boolean
  answeredCount: number
  totalCount: number
  onSubmit: () => void
}

export function SubmitExamButton({
  disabled = false,
  isSubmitting = false,
  answeredCount,
  totalCount,
  onSubmit,
}: SubmitExamButtonProps) {
  const isDisabled = disabled || isSubmitting

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <span style={{ color: '#4b5563', fontSize: '0.95rem' }}>
        {answeredCount} / {totalCount} answered
      </span>
      <Button
        type="button"
        disabled={isDisabled}
        onClick={onSubmit}
        style={{
          padding: '0.75rem 1rem',
          borderRadius: '0.75rem',
          border: '1px solid #2563eb',
          background: isDisabled ? '#93c5fd' : '#2563eb',
          color: '#ffffff',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          fontWeight: 700,
        }}
      >
        {isSubmitting ? 'Submitting answers...' : 'Submit exam'}
      </Button>
    </div>
  )
}
