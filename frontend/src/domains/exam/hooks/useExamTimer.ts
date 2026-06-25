import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

function formatTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function useExamTimer(durationSeconds: MaybeRefOrGetter<number>) {
  const endsAt = ref(0)
  const now = ref(Date.now())

  watch(
    () => Math.max(0, toValue(durationSeconds)),
    (safeDurationSeconds, _, onCleanup) => {
      endsAt.value = Date.now() + safeDurationSeconds * 1000
      now.value = Date.now()

      if (safeDurationSeconds === 0) return

      const timer = window.setInterval(() => {
        now.value = Date.now()
      }, 1000)

      onCleanup(() => window.clearInterval(timer))
    },
    { immediate: true },
  )

  const remainingSeconds = computed(() => Math.max(0, Math.ceil((endsAt.value - now.value) / 1000)))

  return {
    remainingSeconds,
    formattedTime: computed(() => formatTime(remainingSeconds.value)),
    isExpired: computed(() => remainingSeconds.value === 0),
  }
}
