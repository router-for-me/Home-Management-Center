import axios, { type AxiosError, type AxiosInstance } from 'axios'

const USER_PATH = '/user'

export const DEFAULT_USER_API_BASE_URL = USER_PATH

export type UserSessionInput = {
  baseUrl?: string
  token?: string | null
}

class UserApiError extends Error {
  readonly status?: number
  readonly code: string

  constructor(message: string, code: string, status?: number) {
    super(message)
    this.name = 'UserApiError'
    this.code = code
    this.status = status
  }
}

export function isUserApiError(error: unknown): error is UserApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    !Array.isArray(error) &&
    typeof (error as Partial<UserApiError>).message === 'string' &&
    typeof (error as Partial<UserApiError>).code === 'string'
  )
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function parseAbsoluteUrl(rawBaseUrl: string) {
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(rawBaseUrl)
    ? rawBaseUrl
    : `http://${rawBaseUrl}`

  return new URL(withProtocol)
}

export function normalizeUserBaseUrl(rawBaseUrl?: string | null) {
  const trimmed = rawBaseUrl?.trim() ?? ''

  if (!trimmed) return DEFAULT_USER_API_BASE_URL

  if (trimmed.startsWith('/')) {
    return trimTrailingSlash(trimmed)
  }

  const parsed = parseAbsoluteUrl(trimmed)
  const userPathIndex = parsed.pathname.indexOf(USER_PATH)

  if (userPathIndex >= 0) {
    parsed.pathname = parsed.pathname.slice(0, userPathIndex + USER_PATH.length)
  } else {
    parsed.pathname = USER_PATH
  }

  parsed.search = ''
  parsed.hash = ''

  return trimTrailingSlash(parsed.toString())
}

export function createUserClient({ baseUrl, token }: UserSessionInput = {}): AxiosInstance {
  const normalizedBaseUrl = normalizeUserBaseUrl(baseUrl)
  const headers: Record<string, string> = {}

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return axios.create({
    baseURL: normalizedBaseUrl,
    timeout: 12_000,
    headers,
  })
}

export function toUserApiError(error: unknown): UserApiError {
  if (error instanceof UserApiError) return error

  if (error instanceof TypeError || error instanceof DOMException) {
    return new UserApiError(error.message, 'network')
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>
    const status = axiosError.response?.status
    const responseCode = axiosError.response?.data?.error
    const responseMessage = axiosError.response?.data?.message

    return new UserApiError(
      responseMessage ?? responseCode ?? axiosError.message,
      responseCode ?? (status ? 'unknown' : 'network'),
      status,
    )
  }

  if (error instanceof Error) {
    return new UserApiError(error.message, 'unknown')
  }

  return new UserApiError(String(error), 'unknown')
}
