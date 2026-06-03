import { useSyncExternalStore } from 'react'
import { examStore } from '@/domains/exam/store/examStore'

export function useExam() {
  return useSyncExternalStore(examStore.subscribe, examStore.getState)
}
