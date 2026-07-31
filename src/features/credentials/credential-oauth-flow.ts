// Cover the backend's 5-minute callback exchange window so a slow exchange
// surfaces its own failure instead of outliving the polling loop.
export const OAUTH_STATUS_POLL_INTERVAL_MS = 2_000
export const OAUTH_STATUS_POLL_MAX_ATTEMPTS = 150
export const OAUTH_STATUS_POLL_MAX_CONSECUTIVE_ERRORS = 3

export function normalizeCredentialOAuthStatus(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase()
  return normalized || 'unknown'
}

export function isCredentialOAuthSuccess(status: string | null | undefined) {
  return normalizeCredentialOAuthStatus(status) === 'ok'
}

export function isCredentialOAuthFailure(status: string | null | undefined) {
  return normalizeCredentialOAuthStatus(status) === 'error'
}

/**
 * The backend resolves the OAuth state from the pasted redirect URL when the
 * explicit field is empty, so status polling must do the same to stay usable.
 */
export function resolveCredentialOAuthCallbackState(input: { redirectUrl: string; state: string }) {
  const explicit = input.state.trim()
  if (explicit) return explicit

  const match = /(?:^|[?&#])state=([^&]+)/i.exec(input.redirectUrl)
  if (!match?.[1]) return ''

  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}
