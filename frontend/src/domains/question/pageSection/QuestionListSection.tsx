import { useQuestions } from '@/domains/question/hooks/useQuestions'
import { QuestionCard } from '@/domains/question/components/QuestionCard'

export function QuestionListSection({ onAnswer }: { onAnswer: (id: string, opt: 'A' | 'B' | 'C' | 'D') => void }) {
  const { questions } = useQuestions()
  return (
    <div>
      {questions.map((q) => (
        <QuestionCard key={q.id} q={q} onSelect={(opt) => onAnswer(q.id, opt)} />
      ))}
    </div>
  )
}
