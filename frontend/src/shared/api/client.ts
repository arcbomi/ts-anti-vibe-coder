export type ApiResponse<T> = {
  success: boolean
  data: T | null
  error: {
    code: string
    message: string
  } | null
}

export class ApiError extends Error {
  code: string
  status?: number

  constructor(message: string, code = 'API_ERROR', status?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

function baseURL() {
  return import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
}

async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    const message = await response.text().catch(() => response.statusText)
    return {
      success: response.ok,
      data: null,
      error: response.ok ? null : { code: 'HTTP_ERROR', message: message || response.statusText },
    }
  }

  const payload = (await response.json()) as ApiResponse<T> | T

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'success' in payload &&
    'data' in payload &&
    'error' in payload
  ) {
    return payload as ApiResponse<T>
  }

  return {
    success: response.ok,
    data: payload as T,
    error: response.ok ? null : { code: 'HTTP_ERROR', message: response.statusText },
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers = new Headers(init?.headers)

  headers.set('Accept', 'application/json')
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${baseURL()}${path}`, { ...init, headers })
  const payload = await parseResponse<T>(response)

  if (!response.ok || !payload.success || payload.error) {
    throw new ApiError(payload.error?.message ?? response.statusText, payload.error?.code, response.status)
  }

  if (payload.data === null) {
    throw new ApiError('API response did not include data.', 'EMPTY_RESPONSE', response.status)
  }

  return payload.data
}


export const apiClient = {
  get: <T>(path: string, init?: RequestInit) => apiFetch<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    apiFetch<T>(path, { ...init, method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    apiFetch<T>(path, { ...init, method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string, init?: RequestInit) => apiFetch<T>(path, { ...init, method: 'DELETE' }),
}
