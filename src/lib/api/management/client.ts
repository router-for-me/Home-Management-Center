import axios, { type AxiosError, type AxiosInstance } from 'axios'

import type { ManagementApiError, ManagementSessionInput } from '@/lib/api/management/types'

const MANAGEMENT_PATH = '/v0/management'
const DEFAULT_MANAGEMENT_ORIGIN = 'http://localhost:8327'
const DEFAULT_MANAGEMENT_BASE_URL = `${getCurrentHttpOrigin() ?? DEFAULT_MANAGEMENT_ORIGIN}${MANAGEMENT_PATH}`

function getCurrentHttpOrigin() {
  if (typeof window === 'undefined') {
    return null
  }

  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
    return null
  }

  return window.location.origin
}

function isLoopbackHost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  )
}

function parseManagementBaseUrl(rawBaseUrl: string) {
  if (rawBaseUrl.startsWith('/')) {
    return new URL(rawBaseUrl, getCurrentHttpOrigin() ?? DEFAULT_MANAGEMENT_ORIGIN)
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(rawBaseUrl)
    ? rawBaseUrl
    : `http://${rawBaseUrl}`

  return new URL(withProtocol)
}

function shouldUseSameOriginProxy(parsed: URL) {
  const currentOrigin = getCurrentHttpOrigin()

  if (!currentOrigin) {
    return false
  }

  const currentUrl = new URL(currentOrigin)

  return (
    parsed.origin !== currentUrl.origin &&
    parsed.protocol === 'http:' &&
    parsed.port === '8327' &&
    isLoopbackHost(parsed.hostname) &&
    isLoopbackHost(currentUrl.hostname)
  )
}

export function normalizeManagementBaseUrl(rawBaseUrl: string) {
  const trimmed = rawBaseUrl.trim()

  if (!trimmed) {
    return DEFAULT_MANAGEMENT_BASE_URL
  }

  const parsed = parseManagementBaseUrl(trimmed)

  if (shouldUseSameOriginProxy(parsed)) {
    return DEFAULT_MANAGEMENT_BASE_URL
  }

  const managementPathIndex = parsed.pathname.indexOf(MANAGEMENT_PATH)

  if (managementPathIndex >= 0) {
    parsed.pathname = parsed.pathname.slice(0, managementPathIndex + MANAGEMENT_PATH.length)
  } else {
    parsed.pathname = MANAGEMENT_PATH
  }

  parsed.search = ''
  parsed.hash = ''

  return parsed.toString().replace(/\/$/, '')
}

export function createManagementClient({
  baseUrl,
  managementKey,
}: ManagementSessionInput): AxiosInstance {
  return axios.create({
    baseURL: normalizeManagementBaseUrl(baseUrl),
    timeout: 12_000,
    headers: {
      Authorization: `Bearer ${managementKey}`,
      'X-Management-Key': managementKey,
    },
  })
}

export function toManagementApiError(error: unknown): ManagementApiError {
  if (error instanceof TypeError || error instanceof DOMException) {
    return {
      message: error.message,
      code: 'network',
    }
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>
    const status = axiosError.response?.status
    const responseMessage = axiosError.response?.data?.error ?? axiosError.response?.data?.message
    const message = responseMessage ?? axiosError.message

    if (status === 401 || status === 403) {
      return {
        message,
        status,
        code: 'auth',
      }
    }

    if (status === 404) {
      return {
        message,
        status,
        code: 'not-found',
      }
    }

    if (status && status >= 500) {
      return {
        message,
        status,
        code: 'server',
      }
    }

    return {
      message,
      status,
      code: status ? 'unknown' : 'network',
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

export { DEFAULT_MANAGEMENT_BASE_URL }
