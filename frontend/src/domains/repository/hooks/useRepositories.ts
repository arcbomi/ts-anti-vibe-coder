import { useSyncExternalStore } from 'react'
import { repositoryStore } from '@/domains/repository/store/repositoryStore'

export function useRepositories() {
  return useSyncExternalStore(repositoryStore.subscribe, repositoryStore.getState)
}
