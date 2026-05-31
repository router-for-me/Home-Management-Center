import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type UserResource = {
  id: string
  numericId: number | null
  username: string
  hasPassword: boolean
  mfaConfigured: boolean
  passkeyCount: number
  deletedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  raw: unknown
}

export type UserFormInput = {
  username: string
  password?: string
}

type UsersSnapshot = {
  fetchedAt: string
  resources: UserResource[]
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
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

function readArrayRecords(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord)

  const record = toRecord(value)
  for (const key of ['users', 'items', 'records', 'data']) {
    const nextValue = record[key]
    if (Array.isArray(nextValue)) return nextValue.filter(isRecord)
  }

  return []
}

function hasStructuredValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0
  if (isRecord(value)) return Object.keys(value).length > 0
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeUser(record: UnknownRecord, index: number): UserResource {
  const numericId = readNumber(record, ['id', 'user_id', 'userId'])
  const id =
    readString(record, ['id', 'user_id', 'userId', 'uuid']) ??
    (numericId !== null ? String(numericId) : `user-${index + 1}`)
  const username = readString(record, ['username', 'user_name', 'userName', 'name']) ?? id
  const passkey = record.passkey

  return {
    id,
    numericId,
    username,
    hasPassword: typeof record.password === 'string' && record.password.length > 0,
    mfaConfigured: hasStructuredValue(record.mfa),
    passkeyCount: Array.isArray(passkey) ? passkey.length : hasStructuredValue(passkey) ? 1 : 0,
    deletedAt: readString(record, ['deleted_at', 'deletedAt']),
    createdAt: readString(record, ['created_at', 'createdAt']),
    updatedAt: readString(record, ['updated_at', 'updatedAt']),
    raw: record,
  }
}

function toUserPayload(input: UserFormInput) {
  return {
    username: input.username.trim(),
    password: input.password?.trim() || undefined,
  }
}

export async function fetchUsersSnapshot(session: ManagementSessionInput): Promise<UsersSnapshot> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/users')

  return {
    fetchedAt: new Date().toISOString(),
    resources: readArrayRecords(response.data).map((record, index) => normalizeUser(record, index)),
  }
}

export async function fetchUserDetail(session: ManagementSessionInput, userId: string) {
  const client = createManagementClient(session)
  const response = await client.get<unknown>(`/users/${encodeURIComponent(userId)}`)
  const record = toRecord(response.data)
  const userRecord = isRecord(record.user) ? record.user : record

  return normalizeUser(userRecord, 0)
}

export async function createUser(session: ManagementSessionInput, input: UserFormInput) {
  const client = createManagementClient(session)
  await client.post('/users', toUserPayload(input))
}

export async function updateUser(
  session: ManagementSessionInput,
  user: UserResource,
  input: UserFormInput,
) {
  const client = createManagementClient(session)
  await client.patch(`/users/${encodeURIComponent(user.id)}`, toUserPayload(input))
}

export async function deleteUser(session: ManagementSessionInput, user: UserResource) {
  const client = createManagementClient(session)
  await client.delete(`/users/${encodeURIComponent(user.id)}`)
}

export function toUserApiError(error: unknown) {
  const apiError = toManagementApiError(error)
  return new Error(apiError.message, { cause: error })
}
