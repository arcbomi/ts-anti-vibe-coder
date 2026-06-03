import { useEffect, useState } from 'react'

export function useExamTimer(durationSeconds: number) {
  const [endsAt] = useState(() => Date.now() + durationSeconds * 1000)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  return { remainingSeconds: Math.max(0, Math.ceil((endsAt - now) / 1000)) }
}
