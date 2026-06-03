import { Button } from '@/shared/components/Button'

export function SubmitExamButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <Button type="button" disabled={disabled} onClick={onClick}>
      Submit
    </Button>
  )
}
