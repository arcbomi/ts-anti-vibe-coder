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
    <div className="section-stack section-stack--tight">
      <span className="field-hint">
        {answeredCount} / {totalCount} answered
      </span>
      <Button
        type="button"
        disabled={isDisabled}
        onClick={onSubmit}
        className="button--primary button--wide"
      >
        {isSubmitting ? 'Submitting answers...' : 'Submit exam'}
      </Button>
    </div>
  )
}
