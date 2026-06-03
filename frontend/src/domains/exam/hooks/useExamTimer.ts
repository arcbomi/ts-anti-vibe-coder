import { useEffect, useState } from 'react'

export function useExamTimer(durationSeconds: number) {
  const [remaining, setRemaining] = useState(durationSeconds)
  useEffect(() => {
    setRemaining(durationSeconds)
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    return () => clearInterval(t)
  }, [durationSeconds])
  return { remainingSeconds: remaining }
}
