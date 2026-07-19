import axios, { type AxiosError, type AxiosInstance } from 'axios'

import type { ManagementApiError, ManagementSessionInput } from './types'

const MANAGEMENT_PATH = '/v0/management'
const DEFAULT_MANAGEMENT_ORIGIN = 'http://localhost:8327'
const SAME_ORIGIN_MANAGEMENT_BASE_URL = MANAGEMENT_PATH
const CAN_CUSTOMIZE_MANAGEMENT_ENDPOINT = import.meta.env.DEV
const DEFAULT_MANAGEMENT_BASE_URL = SAME_ORIGIN_MANAGEMENT_BASE_URL

function getCurrentHttpOrigin() {
  if (typeof window === 'undefined') {
    return null
  }

  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
    return null
  }

  return window.location.origin
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

export function normalizeManagementBaseUrl(rawBaseUrl: string) {
  const trimmed = rawBaseUrl.trim()

  if (!trimmed) {
    return DEFAULT_MANAGEMENT_BASE_URL
  }

  const parsed = parseManagementBaseUrl(trimmed)
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

export function normalizeManagementSessionBaseUrl(rawBaseUrl: string) {
  if (!CAN_CUSTOMIZE_MANAGEMENT_ENDPOINT) {
    return SAME_ORIGIN_MANAGEMENT_BASE_URL
  }

  const normalizedBaseUrl = normalizeManagementBaseUrl(rawBaseUrl)
  const currentOrigin = getCurrentHttpOrigin()

  if (currentOrigin && normalizedBaseUrl === `${currentOrigin}${MANAGEMENT_PATH}`) {
    return SAME_ORIGIN_MANAGEMENT_BASE_URL
  }

  return normalizedBaseUrl
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

type ResponseErrorDetails = {
  message: string | null
  backendCode?: string
  requestId?: string
  retryable?: boolean
}

function readResponseErrorDetails(data: unknown): ResponseErrorDetails {
  if (!data || typeof data !== 'object') return { message: null }

  const response = data as Record<string, unknown>
  const directMessage = response.message
  const details: ResponseErrorDetails = {
    message:
      typeof directMessage === 'string' && directMessage.trim() ? directMessage.trim() : null,
  }

  const error = response.error
  if (typeof error === 'string' && error.trim()) {
    details.backendCode = error.trim()
    details.message ??= error.trim()
    return details
  }
  if (error && typeof error === 'object') {
    const nested = error as Record<string, unknown>
    const nestedMessage = nested.message
    const backendCode = nested.code
    const requestId = nested.request_id ?? nested.requestId
    const retryable = nested.retryable

    if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
      details.message = nestedMessage.trim()
    }
    if (typeof backendCode === 'string' && backendCode.trim()) {
      details.backendCode = backendCode.trim()
    }
    if (typeof requestId === 'string' && requestId.trim()) {
      details.requestId = requestId.trim()
    }
    if (typeof retryable === 'boolean') details.retryable = retryable
  }

  return details
}

export function toManagementApiError(error: unknown): ManagementApiError {
  if (error instanceof TypeError || error instanceof DOMException) {
    return {
      message: error.message,
      code: 'network',
    }
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<unknown>
    const status = axiosError.response?.status
    const responseError = readResponseErrorDetails(axiosError.response?.data)
    const message = responseError.message ?? axiosError.message
    const backendDetails = {
      ...(responseError.backendCode ? { backendCode: responseError.backendCode } : {}),
      ...(responseError.requestId ? { requestId: responseError.requestId } : {}),
      ...(typeof responseError.retryable === 'boolean'
        ? { retryable: responseError.retryable }
        : {}),
    }

    if (status === 401 || status === 403) {
      return {
        message,
        status,
        code: 'auth',
        ...backendDetails,
      }
    }

    if (status === 404) {
      return {
        message,
        status,
        code: 'not-found',
        ...backendDetails,
      }
    }

    if (status && status >= 500) {
      return {
        message,
        status,
        code: 'server',
        ...backendDetails,
      }
    }

    return {
      message,
      status,
      code: status ? 'unknown' : 'network',
      ...backendDetails,
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
export { CAN_CUSTOMIZE_MANAGEMENT_ENDPOINT }
export { SAME_ORIGIN_MANAGEMENT_BASE_URL }
