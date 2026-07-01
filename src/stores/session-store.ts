import { create } from 'zustand'

import {
  DEFAULT_MANAGEMENT_BASE_URL,
  SAME_ORIGIN_MANAGEMENT_BASE_URL,
  normalizeManagementBaseUrl,
  normalizeManagementSessionBaseUrl,
} from '@/lib/api/management/client'
import type { ManagementApiError } from '@/lib/api/management/types'

const LOCAL_STORAGE_KEY = 'home-management-center.managementSession'
const SESSION_STORAGE_KEY = 'home-management-center.temporaryManagementSession'

type ConnectionStatus = 'disconnected' | 'checking' | 'connected' | 'error'

type StoredSession = {
  baseUrl: string
  managementKey: string
  rememberConnection: boolean
}

type SessionState = {
  baseUrl: string
  managementKey: string
  rememberConnection: boolean
  detectedBaseUrl: string | null
  detectedSource: 'runtime' | 'same-origin' | null
  detectedAt: string | null
  status: ConnectionStatus
  error: ManagementApiError | null
  connectedAt: string | null
  setDetectedRuntime: (
    baseUrl: string,
    source?: NonNullable<SessionState['detectedSource']>,
  ) => void
  setChecking: (session: StoredSession) => void
  setConnected: (session: StoredSession) => void
  setError: (error: ManagementApiError) => void
  disconnect: () => void
}

function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null

  const parsed = JSON.parse(raw) as Partial<StoredSession>
  if (!parsed.baseUrl || !parsed.managementKey) return null

  return {
    baseUrl: normalizeManagementSessionBaseUrl(parsed.baseUrl),
    managementKey: parsed.managementKey,
    rememberConnection: Boolean(parsed.rememberConnection),
  }
}

function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null

  try {
    return (
      parseStoredSession(window.localStorage.getItem(LOCAL_STORAGE_KEY)) ??
      parseStoredSession(window.sessionStorage.getItem(SESSION_STORAGE_KEY))
    )
  } catch {
    return null
  }
}

function writeStoredSession(session: StoredSession) {
  if (typeof window === 'undefined') return

  if (!session.rememberConnection) {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY)
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    return
  }

  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(session))
}

function clearStoredSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LOCAL_STORAGE_KEY)
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
}

function getSessionBaseUrlSource(baseUrl: string): NonNullable<SessionState['detectedSource']> {
  return baseUrl === SAME_ORIGIN_MANAGEMENT_BASE_URL ? 'same-origin' : 'runtime'
}

const initialSession = readStoredSession()

export const useSessionStore = create<SessionState>((set) => ({
  baseUrl: initialSession?.baseUrl ?? DEFAULT_MANAGEMENT_BASE_URL,
  managementKey: initialSession?.managementKey ?? '',
  rememberConnection: initialSession?.rememberConnection ?? false,
  detectedBaseUrl: null,
  detectedSource: null,
  detectedAt: null,
  status: initialSession ? 'checking' : 'disconnected',
  error: null,
  connectedAt: null,
  setDetectedRuntime: (baseUrl, source = 'runtime') => {
    const normalizedBaseUrl =
      source === 'same-origin'
        ? SAME_ORIGIN_MANAGEMENT_BASE_URL
        : normalizeManagementBaseUrl(baseUrl)

    set((state) => {
      const detectedState = {
        detectedBaseUrl: normalizedBaseUrl,
        detectedSource: source,
        detectedAt: new Date().toISOString(),
      }

      if (state.status === 'connected' || state.status === 'checking') {
        return detectedState
      }

      if (source === 'runtime' && state.managementKey) {
        return detectedState
      }

      if (source === 'same-origin') {
        return detectedState
      }

      return {
        ...detectedState,
        baseUrl: normalizedBaseUrl,
        status: 'disconnected',
        error: null,
      }
    })
  },
  setChecking: (session) => {
    const normalizedSession = {
      ...session,
      baseUrl: normalizeManagementSessionBaseUrl(session.baseUrl),
    }

    set({
      ...normalizedSession,
      status: 'checking',
      error: null,
    })
  },
  setConnected: (session) => {
    const normalizedSession = {
      ...session,
      baseUrl: normalizeManagementSessionBaseUrl(session.baseUrl),
    }
    const connectedAt = new Date().toISOString()

    writeStoredSession(normalizedSession)
    set({
      ...normalizedSession,
      status: 'connected',
      error: null,
      connectedAt,
      detectedBaseUrl: normalizedSession.baseUrl,
      detectedSource: getSessionBaseUrlSource(normalizedSession.baseUrl),
      detectedAt: connectedAt,
    })
  },
  setError: (error) => {
    set({
      status: 'error',
      error,
      connectedAt: null,
    })
  },
  disconnect: () => {
    clearStoredSession()
    set({
      managementKey: '',
      rememberConnection: false,
      status: 'disconnected',
      error: null,
      connectedAt: null,
    })
  },
}))
