type Matcher = RegExp | string

type RouteDefinition = {
  path: string
  component: unknown
}

type RoleOptions = {
  checked?: boolean
  name?: Matcher
}

type WaitForOptions = {
  interval?: number
  timeout?: number
}

let activeUnmount: (() => void) | null = null

export const canUseZustandStores = true

export async function renderRouteView({
  initialEntry,
  routes,
}: {
  initialEntry: string
  routes: RouteDefinition[]
}) {
  cleanupTestApp()

  const container = document.createElement('div')
  document.body.innerHTML = ''
  document.body.appendChild(container)

  const { createApp, h } = await import('vue')
  const { RouterView, createMemoryHistory, createRouter } = await import('vue-router')

  const router = createRouter({
    history: createMemoryHistory(),
    routes: routes.map((route) => ({
      component: route.component,
      path: route.path,
    })),
  })

  const app = createApp({
    render: () => h(RouterView),
  })

  app.use(router)
  await router.push(initialEntry)
  await router.isReady()
  app.mount(container)

  activeUnmount = () => {
    app.unmount()
  }

  await flushUi()

  return {
    unmount() {
      cleanupTestApp()
    },
  }
}

export function cleanupTestApp() {
  activeUnmount?.()
  activeUnmount = null
  document.body.innerHTML = ''
}

export async function click(element: HTMLElement) {
  element.click()
  await flushUi()
}

export async function typeText(element: HTMLElement, value: string) {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    throw new Error(`Cannot type into ${element.tagName.toLowerCase()}.`)
  }

  element.focus()
  setElementValue(element, '')
  element.dispatchEvent(new Event('input', { bubbles: true }))

  for (const character of value) {
    setElementValue(element, `${element.value}${character}`)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }

  element.dispatchEvent(new Event('change', { bubbles: true }))
  await flushUi()
}

export async function waitFor<T>(assertion: () => T, options: WaitForOptions = {}) {
  const timeout = options.timeout ?? 3_000
  const interval = options.interval ?? 20
  const startedAt = Date.now()

  while (true) {
    try {
      return assertion()
    } catch (error) {
      if (Date.now() - startedAt >= timeout) {
        throw error
      }

      await sleep(interval)
    }
  }
}

export const screen = {
  findAllByText(matcher: Matcher, options?: WaitForOptions) {
    return waitFor(() => getAllByText(matcher), options)
  },
  findByLabelText(matcher: Matcher, options?: WaitForOptions) {
    return waitFor(() => getByLabelText(matcher), options)
  },
  findByRole(role: string, options?: RoleOptions & WaitForOptions) {
    const { checked, name, ...waitOptions } = options ?? {}
    return waitFor(() => getByRole(role, { checked, name }), waitOptions)
  },
  findByText(matcher: Matcher, options?: WaitForOptions) {
    return waitFor(() => getByText(matcher), options)
  },
  findAllByRole(role: string, options?: RoleOptions & WaitForOptions) {
    const { checked, name, ...waitOptions } = options ?? {}
    return waitFor(() => getAllByRole(role, { checked, name }), waitOptions)
  },
  getAllByRole,
  getAllByText,
  getByLabelText,
  getByRole,
  getByText,
  queryByText,
}

function getByLabelText(matcher: Matcher) {
  const ariaMatch = Array.from(document.querySelectorAll<HTMLElement>('[aria-label]')).find((candidate) =>
    matches(candidate.getAttribute('aria-label'), matcher),
  )

  if (ariaMatch) {
    return ariaMatch
  }

  const labels = Array.from(document.querySelectorAll('label'))
  const label = labels.find((candidate) => matches(normalizeText(candidate.textContent), matcher))

  if (!label) {
    throw new Error(`Unable to find a label matching ${matcherToString(matcher)}.`)
  }

  const nestedControl = label.querySelector('input, textarea, select')
  if (nestedControl instanceof HTMLElement) {
    return nestedControl
  }

  if (label.htmlFor) {
    const control = document.getElementById(label.htmlFor)
    if (control instanceof HTMLElement) {
      return control
    }
  }

  throw new Error(`Found label ${matcherToString(matcher)} but no associated control.`)
}

function getByRole(role: string, options: RoleOptions = {}) {
  return getSingle(queryAllByRole(role, options), `role=${role}${formatRoleOptions(options)}`)
}

function getAllByRole(role: string, options: RoleOptions = {}) {
  const matches = queryAllByRole(role, options)
  if (matches.length === 0) {
    throw new Error(`Unable to find any elements with role=${role}${formatRoleOptions(options)}.`)
  }
  return matches
}

function getByText(matcher: Matcher) {
  return getSingle(queryAllByText(matcher), `text ${matcherToString(matcher)}`)
}

function getAllByText(matcher: Matcher) {
  const matches = queryAllByText(matcher)
  if (matches.length === 0) {
    throw new Error(`Unable to find any elements matching ${matcherToString(matcher)}.`)
  }
  return matches
}

function queryByText(matcher: Matcher) {
  return queryAllByText(matcher)[0] ?? null
}

function queryAllByRole(role: string, options: RoleOptions) {
  return Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter((element) => {
    if (getRole(element) !== role) {
      return false
    }

    if (options.checked !== undefined) {
      const isChecked = element instanceof HTMLInputElement ? element.checked : element.getAttribute('aria-checked') === 'true'
      if (isChecked !== options.checked) {
        return false
      }
    }

    if (options.name !== undefined && !matches(getAccessibleName(element), options.name)) {
      return false
    }

    return true
  })
}

function queryAllByText(matcher: Matcher) {
  return Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter((element) => {
    const text = normalizeText(element.textContent)
    if (!text || !matches(text, matcher)) {
      return false
    }

    return Array.from(element.children).every((child) => !matches(normalizeText(child.textContent), matcher))
  })
}

function getRole(element: HTMLElement) {
  const explicitRole = element.getAttribute('role')
  if (explicitRole) return explicitRole

  const tag = element.tagName.toLowerCase()
  if (tag === 'button') return 'button'
  if (tag === 'a' && element.getAttribute('href')) return 'link'
  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') return 'heading'
  if (tag === 'progress') return 'progressbar'
  if (tag === 'input') {
    const input = element as HTMLInputElement
    if (input.type === 'checkbox') return 'checkbox'
    if (input.type === 'radio') return 'radio'
    return 'textbox'
  }
  return null
}

function getAccessibleName(element: HTMLElement) {
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel) return normalizeText(ariaLabel)
  return normalizeText(element.textContent)
}

function getSingle<T>(matches: T[], target: string) {
  if (matches.length === 0) {
    throw new Error(`Unable to find ${target}.`)
  }
  if (matches.length > 1) {
    throw new Error(`Found multiple elements for ${target}.`)
  }
  return matches[0]
}

function matches(value: string | null | undefined, matcher: Matcher) {
  const normalizedValue = normalizeText(value)
  if (typeof matcher === 'string') {
    return normalizedValue === normalizeText(matcher)
  }
  return matcher.test(normalizedValue)
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function matcherToString(matcher: Matcher) {
  return typeof matcher === 'string' ? `"${matcher}"` : matcher.toString()
}

function formatRoleOptions(options: RoleOptions) {
  const parts = []
  if (options.name !== undefined) parts.push(`name=${matcherToString(options.name)}`)
  if (options.checked !== undefined) parts.push(`checked=${String(options.checked)}`)
  return parts.length > 0 ? ` (${parts.join(', ')})` : ''
}

function setElementValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')
  descriptor?.set?.call(element, value)
}

async function flushUi() {
  await Promise.resolve()
  await Promise.resolve()
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
