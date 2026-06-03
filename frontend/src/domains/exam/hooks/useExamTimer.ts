import { useEffect, useMemo, useState } from 'react'

function formatTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function useExamTimer(durationSeconds: number) {
  const safeDurationSeconds = Math.max(0, durationSeconds)
  const [endsAt] = useState(() => Date.now() + safeDurationSeconds * 1000)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (safeDurationSeconds === 0) return undefined

    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [safeDurationSeconds])

  const remainingSeconds = Math.max(0, Math.ceil((endsAt - now) / 1000))

  return useMemo(
    () => ({
      remainingSeconds,
      formattedTime: formatTime(remainingSeconds),
      isExpired: remainingSeconds === 0,
    }),
    [remainingSeconds],
  )
}
