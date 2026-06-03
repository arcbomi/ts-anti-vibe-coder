export type AuthUser = {
  id: string
  email: string
  name: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type LoginResponse = {
  user: AuthUser
  token: string
}

export type AuthState = {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  error: string | null
}
