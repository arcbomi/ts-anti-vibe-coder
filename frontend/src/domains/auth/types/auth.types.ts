export type AuthUser = {
  id: string
  email: string
  name: string
  full_name?: string
}

export type LoginRequest = {
  credential: string
  password: string
}

export type LoginResponse = {
  user: AuthUser
  token: string
}

export type RawLoginResponse = {
  user: AuthUser
  access_token?: string
  token?: string
}

export type AuthState = {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  error: string | null
}
