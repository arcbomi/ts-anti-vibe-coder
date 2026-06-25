import { onBeforeUnmount, shallowRef, type ShallowRef } from 'vue'

type StoreWithSubscribe<T> = {
  getState: () => T
  subscribe: (listener: (...args: unknown[]) => void) => () => void
}

export function useVanillaStore<T>(store: StoreWithSubscribe<T>): ShallowRef<T> {
  const state = shallowRef(store.getState()) as ShallowRef<T>
  const unsubscribe = store.subscribe(() => {
    state.value = store.getState()
  })

  onBeforeUnmount(unsubscribe)

  return state
}
