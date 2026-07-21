import { create } from 'zustand'

import { type UserAccount, type UserAuthSession, normalizeUserAccount } from '@/lib/api/user/auth'
import { DEFAULT_USER_API_BASE_URL, normalizeUserBaseUrl } from '@/lib/api/user/client'

const LOCAL_STORAGE_KEY = 'home-management-center.userSession'
const SESSION_STORAGE_KEY = 'home-management-center.temporaryUserSession'

type UserSessionStatus = 'disconnected' | 'checking' | 'authenticated' | 'error'

type StoredUserSession = {
  baseUrl: string
  token: string
  expiresAt: string
  user: UserAccount
  rememberSession: boolean
}

type UserSessionState = {
  status: UserSessionStatus
  baseUrl: string
  token: string | null
  expiresAt: string | null
  user: UserAccount | null
  rememberSession: boolean
  errorMessage: string | null
  setChecking: () => void
  setAuthenticated: (session: UserAuthSession, rememberSession: boolean, baseUrl?: string) => void
  replaceAuthenticatedSession: (session: UserAuthSession) => void
  setError: (message: string) => void
  updateUser: (user: UserAccount) => void
  logout: () => void
  reset: () => void
}

function isStoredSession(value: unknown): value is StoredUserSession {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  const record = value as Partial<StoredUserSession>

  return (
    typeof record.baseUrl === 'string' &&
    typeof record.token === 'string' &&
    typeof record.expiresAt === 'string' &&
    typeof record.user === 'object' &&
    record.user !== null
  )
}

function isExpired(expiresAt: string) {
  const timestamp = Date.parse(expiresAt)
  return !Number.isFinite(timestamp) || timestamp <= Date.now()
}

function parseStoredSession(raw: string | null): StoredUserSession | null {
  if (!raw) return null

  const parsed = JSON.parse(raw) as unknown
  if (!isStoredSession(parsed) || isExpired(parsed.expiresAt)) return null

  return {
    ...parsed,
    baseUrl: normalizeUserBaseUrl(parsed.baseUrl),
    user: normalizeUserAccount(parsed.user),
    rememberSession: Boolean(parsed.rememberSession),
  }
}

function readStoredSession(): StoredUserSession | null {
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

function writeStoredSession(session: StoredUserSession) {
  if (typeof window === 'undefined') return

  if (!session.rememberSession) {
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

export const useUserSessionStore = create<UserSessionState>((set, get) => ({
  status: initialSession ? 'authenticated' : 'disconnected',
  baseUrl: initialSession?.baseUrl ?? DEFAULT_USER_API_BASE_URL,
  token: initialSession?.token ?? null,
  expiresAt: initialSession?.expiresAt ?? null,
  user: initialSession?.user ?? null,
  rememberSession: initialSession?.rememberSession ?? false,
  errorMessage: null,
  setChecking: () =>
    set({
      status: 'checking',
      errorMessage: null,
    }),
  setAuthenticated: (session, rememberSession, baseUrl) => {
    const nextSession: StoredUserSession = {
      baseUrl: normalizeUserBaseUrl(baseUrl ?? get().baseUrl),
      token: session.token,
      expiresAt: session.expiresAt,
      user: session.user,
      rememberSession,
    }

    writeStoredSession(nextSession)
    set({
      ...nextSession,
      status: 'authenticated',
      errorMessage: null,
    })
  },
  replaceAuthenticatedSession: (session) => {
    const state = get()
    const nextSession: StoredUserSession = {
      baseUrl: normalizeUserBaseUrl(state.baseUrl),
      token: session.token,
      expiresAt: session.expiresAt,
      user: session.user,
      rememberSession: state.rememberSession,
    }

    writeStoredSession(nextSession)
    set({
      ...nextSession,
      status: 'authenticated',
      errorMessage: null,
    })
  },
  setError: (message) =>
    set({
      status: 'error',
      errorMessage: message,
    }),
  updateUser: (user) =>
    set((state) => {
      if (!state.token || !state.expiresAt) {
        return { user }
      }

      const nextSession: StoredUserSession = {
        baseUrl: state.baseUrl,
        token: state.token,
        expiresAt: state.expiresAt,
        user,
        rememberSession: state.rememberSession,
      }

      writeStoredSession(nextSession)

      return { user }
    }),
  logout: () => {
    clearStoredSession()
    set({
      status: 'disconnected',
      token: null,
      expiresAt: null,
      user: null,
      rememberSession: false,
      errorMessage: null,
    })
  },
  reset: () =>
    set({
      status: 'disconnected',
      token: null,
      expiresAt: null,
      user: null,
      rememberSession: false,
      errorMessage: null,
    }),
}))
