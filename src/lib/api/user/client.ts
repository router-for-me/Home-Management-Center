import axios, { type AxiosError, type AxiosInstance } from 'axios'

const USER_PATH = '/user'
const MANAGEMENT_PATH = '/v0/management'

export const DEFAULT_USER_API_BASE_URL = USER_PATH

export type UserSessionInput = {
  baseUrl?: string
  token?: string | null
}

export type UserApiError = {
  message: string
  status?: number
  code: string
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

function getCurrentHttpOrigin() {
  if (typeof window === 'undefined') return null
  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return null
  return window.location.origin
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
  const managementPathIndex = parsed.pathname.indexOf(MANAGEMENT_PATH)
  const userPathIndex = parsed.pathname.indexOf(USER_PATH)

  if (managementPathIndex >= 0) {
    parsed.pathname = parsed.pathname.slice(0, managementPathIndex) + USER_PATH
  } else if (userPathIndex >= 0) {
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
  if (error instanceof TypeError || error instanceof DOMException) {
    return {
      message: error.message,
      code: 'network',
    }
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>
    const status = axiosError.response?.status
    const responseCode = axiosError.response?.data?.error
    const responseMessage = axiosError.response?.data?.message

    return {
      message: responseMessage ?? responseCode ?? axiosError.message,
      status,
      code: responseCode ?? (status ? 'unknown' : 'network'),
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'unknown',
    }
  }

  return {
    message: String(error),
    code: 'unknown',
  }
}

export function userBaseUrlFromManagementBaseUrl(baseUrl: string) {
  const origin = getCurrentHttpOrigin()
  if (baseUrl.startsWith('/') && origin) {
    return normalizeUserBaseUrl(new URL(baseUrl, origin).toString())
  }

  return normalizeUserBaseUrl(baseUrl)
}
