import { create } from 'zustand'

import {
  DEFAULT_MANAGEMENT_BASE_URL,
  normalizeManagementBaseUrl,
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
  detectedAt: string | null
  status: ConnectionStatus
  error: ManagementApiError | null
  connectedAt: string | null
  setDetectedRuntime: (baseUrl: string) => void
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
    baseUrl: normalizeManagementBaseUrl(parsed.baseUrl),
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

const initialSession = readStoredSession()

export const useSessionStore = create<SessionState>((set) => ({
  baseUrl: initialSession?.baseUrl ?? DEFAULT_MANAGEMENT_BASE_URL,
  managementKey: initialSession?.managementKey ?? '',
  rememberConnection: initialSession?.rememberConnection ?? false,
  detectedBaseUrl: null,
  detectedAt: null,
  status: 'disconnected',
  error: null,
  connectedAt: null,
  setDetectedRuntime: (baseUrl) => {
    const normalizedBaseUrl = normalizeManagementBaseUrl(baseUrl)

    set((state) => {
      const detectedState = {
        detectedBaseUrl: normalizedBaseUrl,
        detectedAt: new Date().toISOString(),
      }

      if (state.status === 'connected' || state.status === 'checking') {
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
      baseUrl: normalizeManagementBaseUrl(session.baseUrl),
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
      baseUrl: normalizeManagementBaseUrl(session.baseUrl),
    }

    writeStoredSession(normalizedSession)
    set({
      ...normalizedSession,
      status: 'connected',
      error: null,
      connectedAt: new Date().toISOString(),
      detectedBaseUrl: normalizedSession.baseUrl,
      detectedAt: new Date().toISOString(),
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
