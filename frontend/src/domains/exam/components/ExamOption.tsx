import { Button } from '@/shared/components/Button'

export function ExamOption({ label, onSelect }: { label: string; onSelect: () => void }) {
  return (
    <Button type="button" onClick={onSelect}>
      {label}
    </Button>
  )
}
