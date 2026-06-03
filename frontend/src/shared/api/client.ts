export type APIError = {
  message: string
  status?: number
}

function baseURL() {
  return (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:8080'
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const resp = await fetch(`${baseURL()}${path}`, { ...init, headers })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw { message: text || resp.statusText, status: resp.status } satisfies APIError
  }
  return (await resp.json()) as T
}
