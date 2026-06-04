const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const API_BASE_URL = rawApiBaseUrl ?? ''

export type ApiErrorBody = {
  code: string
  message: string
  details?: Record<string, unknown>
}

export type ApiResponse<T> = {
  success: boolean
  data: T | null
  error: ApiErrorBody | null
}

export class ApiError extends Error {
  code: string
  status?: number
  details?: Record<string, unknown>

  constructor(message: string, code = 'API_ERROR', status?: number, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

type RequestOptions = Omit<RequestInit, 'body' | 'method'> & {
  body?: unknown
  method?: string
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null

  return localStorage.getItem('auth_token') ?? localStorage.getItem('access_token')
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path

  const baseUrl = API_BASE_URL.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${baseUrl}${normalizedPath}`
}

function buildHeaders(options: RequestOptions): Headers {
  const headers = new Headers(options.headers)
  const token = getAccessToken()

  headers.set('Accept', 'application/json')

  if (options.body !== undefined && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return headers
}

function serializeBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined
  if (body instanceof FormData) return body
  if (typeof body === 'string') return body
  if (body instanceof Blob) return body
  if (body instanceof ArrayBuffer) return body
  if (body instanceof URLSearchParams) return body

  return JSON.stringify(body)
}

async function parseJsonResponse<T>(response: Response): Promise<ApiResponse<T>> {
  if (response.status === 204) {
    return {
      success: response.ok,
      data: null,
      error: null,
    }
  }

  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    const message = await response.text().catch(() => response.statusText)

    return {
      success: false,
      data: null,
      error: {
        code: response.ok ? 'INVALID_JSON_RESPONSE' : 'HTTP_ERROR',
        message: message || response.statusText || 'Unexpected non-JSON API response.',
      },
    }
  }

  return (await response.json()) as ApiResponse<T>
}

function assertSuccessfulResponse<T>(payload: ApiResponse<T>, response: Response): T {
  if (!response.ok || !payload.success || payload.error) {
    throw new ApiError(
      payload.error?.message ?? response.statusText ?? 'API request failed.',
      payload.error?.code ?? 'API_ERROR',
      response.status,
      payload.error?.details,
    )
  }

  return payload.data as T
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = buildHeaders(options)

  try {
    const response = await fetch(buildUrl(path), {
      ...options,
      headers,
      body: serializeBody(options.body),
    })

    const payload = await parseJsonResponse<T>(response)

    return assertSuccessfulResponse(payload, response)
  } catch (error) {
    if (error instanceof ApiError) throw error

    throw new ApiError(
      error instanceof Error ? error.message : 'Network request failed.',
      'NETWORK_ERROR',
    )
  }
}

export function get<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, { ...options, method: 'GET' })
}

export function post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>(path, { ...options, method: 'POST', body })
}

export function put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>(path, { ...options, method: 'PUT', body })
}

export function del<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, { ...options, method: 'DELETE' })
}

export const apiFetch = request

export const apiClient = {
  get,
  post,
  put,
  delete: del,
  del,
}
