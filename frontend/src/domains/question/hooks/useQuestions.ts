import { useSyncExternalStore } from 'react'
import { questionStore } from '@/domains/question/store/questionStore'

export function useQuestions() {
  return useSyncExternalStore(questionStore.subscribe, questionStore.getState)
}
