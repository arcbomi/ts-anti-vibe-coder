import { Button } from '@/shared/components/Button'

export function OptionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button type="button" onClick={onClick}>{label}</Button>
}
