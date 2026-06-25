import { afterEach } from 'vitest'

import { cleanupTestApp } from './support/integrationHarness'

function createStorageMock() {
  const store = new Map<string, string>()

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  }
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: createStorageMock(),
    configurable: true,
  })
  Object.defineProperty(window, 'sessionStorage', {
    value: createStorageMock(),
    configurable: true,
  })
}

afterEach(() => {
  cleanupTestApp()
})
