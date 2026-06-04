import { type UserSessionInput, createUserClient, toUserApiError } from '@/lib/api/user/client'

type UnknownRecord = Record<string, unknown>

export type UserAccount = {
  id: number | null
  username: string
  credits: number
  totpEnabled: boolean
  passkeyCount: number
  createdAt: string | null
  updatedAt: string | null
  raw: unknown
}

export type UserAuthSession = {
  token: string
  expiresAt: string
  user: UserAccount
}

export type UserAuthInput = {
  username: string
  password: string
}

export type UserTotpLoginInput = UserAuthInput & {
  totpCode: string
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

function readNumber(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

function readBoolean(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
  }
  return false
}

export function normalizeUserAccount(value: unknown): UserAccount {
  const record = isRecord(value) ? value : {}
  const id = readNumber(record, ['id', 'user_id', 'userId'])
  const username = readString(record, ['username', 'user_name', 'userName', 'name'])

  return {
    id,
    username: username ?? (id !== null ? String(id) : ''),
    credits: readNumber(record, ['credits']) ?? 0,
    totpEnabled: readBoolean(record, ['totp_enabled', 'totpEnabled']),
    passkeyCount: readNumber(record, ['passkey_count', 'passkeyCount']) ?? 0,
    createdAt: readString(record, ['created_at', 'createdAt']),
    updatedAt: readString(record, ['updated_at', 'updatedAt']),
    raw: value,
  }
}

function normalizeAuthSession(value: unknown): UserAuthSession {
  const record = isRecord(value) ? value : {}
  const token = readString(record, ['token'])
  const expiresAt = readString(record, ['expires_at', 'expiresAt'])
  const user = normalizeUserAccount(record.user)

  if (!token || !expiresAt) {
    throw new Error('invalid user auth response')
  }

  return {
    token,
    expiresAt,
    user,
  }
}

export async function registerUser(
  input: UserAuthInput,
  session: UserSessionInput = {},
): Promise<UserAuthSession> {
  const client = createUserClient(session)

  try {
    const response = await client.post<unknown>('/register', {
      username: input.username.trim(),
      password: input.password,
    })

    return normalizeAuthSession(response.data)
  } catch (error) {
    throw toUserApiError(error)
  }
}

export async function loginUser(
  input: UserAuthInput,
  session: UserSessionInput = {},
): Promise<UserAuthSession> {
  const client = createUserClient(session)

  try {
    const response = await client.post<unknown>('/login', {
      username: input.username.trim(),
      password: input.password,
    })

    return normalizeAuthSession(response.data)
  } catch (error) {
    throw toUserApiError(error)
  }
}

export async function fetchUserMe(session: UserSessionInput = {}): Promise<UserAccount> {
  const client = createUserClient(session)

  try {
    const response = await client.get<unknown>('/me')

    const record =
      typeof response.data === 'object' &&
      response.data !== null &&
      !Array.isArray(response.data)
        ? (response.data as UnknownRecord)
        : {}

    const userData = record.user ?? record

    return normalizeUserAccount(userData)
  } catch (error) {
    throw toUserApiError(error)
  }
}

export async function loginUserWithTotp(
  input: UserTotpLoginInput,
  session: UserSessionInput = {},
): Promise<UserAuthSession> {
  const client = createUserClient(session)

  try {
    const response = await client.post<unknown>('/login/totp', {
      username: input.username.trim(),
      password: input.password,
      totp_code: input.totpCode.trim(),
    })

    return normalizeAuthSession(response.data)
  } catch (error) {
    throw toUserApiError(error)
  }
}
