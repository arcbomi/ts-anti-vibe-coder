import { OptionButton } from '@/domains/question/components/OptionButton'

export function ExamOption({ label, onSelect }: { label: string; onSelect: () => void }) {
  return <OptionButton label={label} onClick={onSelect} />
}
