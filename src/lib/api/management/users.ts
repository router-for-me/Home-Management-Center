import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type UserRole = 'admin' | 'user' | 'unknown'

export type UserQuotaSummary = {
  unlimited: boolean
  lifetimeQuotaUsd: number | null
  lifetimeRemainingUsd: number | null
  monthlyQuotaUsd: number | null
  monthlyUsedUsd: number | null
  monthlyRemainingUsd: number | null
  quotaMonth: string | null
  paused: boolean
  pausedAt: string | null
  pauseReason: string | null
  unpricedRecords: number
  canCreateKeys: boolean | null
  raw: unknown
}

export type UserUsageSummary = {
  todayRecords: number
  todayTotalTokens: number
  todayEstimatedCostUsd: number
  successRate: number | null
  rpm: number | null
  tpm: number | null
}

export type UserResource = {
  id: string
  numericId: number | null
  username: string
  nickname: string | null
  label: string
  role: UserRole
  isAdmin: boolean
  disabled: boolean
  disabledAt: string | null
  createdAt: string | null
  updatedAt: string | null
  keyCount: number
  usage: UserUsageSummary
  quota: UserQuotaSummary | null
  raw: unknown
}

export type UserFormInput = {
  username: string
  nickname: string
  role: 'admin' | 'user'
  password?: string
}

export type UsersSnapshot = {
  fetchedAt: string
  resources: UserResource[]
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function readString(record: UnknownRecord, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function readStringFromKeys(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = readString(record, key)
    if (value) return value
  }
  return null
}

function readNumber(record: UnknownRecord, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readNumberFromKeys(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = readNumber(record, key)
    if (value !== null) return value
  }
  return null
}

function readBoolean(record: UnknownRecord, key: string): boolean | null {
  const value = record[key]
  return typeof value === 'boolean' ? value : null
}

function readBooleanFromKeys(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = readBoolean(record, key)
    if (value !== null) return value
  }
  return null
}

function readRecordFromKeys(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (isRecord(value)) return value
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

function normalizeRole(record: UnknownRecord): UserRole {
  const role = readStringFromKeys(record, ['role', 'group', 'user_role', 'userRole'])
  const normalizedRole = role?.trim().toLowerCase()
  const isAdmin = readBooleanFromKeys(record, ['is_admin', 'isAdmin', 'admin'])

  if (normalizedRole === 'admin' || normalizedRole === 'administrator' || isAdmin === true) {
    return 'admin'
  }

  if (normalizedRole === 'user' || normalizedRole === 'member' || isAdmin === false) {
    return 'user'
  }

  return 'unknown'
}

function normalizeQuota(value: unknown): UserQuotaSummary | null {
  if (!isRecord(value)) return null

  return {
    unlimited: readBooleanFromKeys(value, ['unlimited', 'is_unlimited', 'isUnlimited']) ?? false,
    lifetimeQuotaUsd: readNumberFromKeys(value, [
      'lifetime_quota_usd',
      'lifetimeQuotaUsd',
      'lifetime_quota',
      'lifetimeQuota',
    ]),
    lifetimeRemainingUsd: readNumberFromKeys(value, [
      'lifetime_remaining_usd',
      'lifetimeRemainingUsd',
      'lifetime_remaining',
      'lifetimeRemaining',
    ]),
    monthlyQuotaUsd: readNumberFromKeys(value, [
      'monthly_quota_usd',
      'monthlyQuotaUsd',
      'monthly_quota',
      'monthlyQuota',
    ]),
    monthlyUsedUsd: readNumberFromKeys(value, [
      'monthly_used_usd',
      'monthlyUsedUsd',
      'monthly_used',
      'monthlyUsed',
    ]),
    monthlyRemainingUsd: readNumberFromKeys(value, [
      'monthly_remaining_usd',
      'monthlyRemainingUsd',
      'monthly_remaining',
      'monthlyRemaining',
    ]),
    quotaMonth: readStringFromKeys(value, ['quota_month', 'quotaMonth']),
    paused: readBooleanFromKeys(value, ['paused', 'quota_paused', 'quotaPaused']) ?? false,
    pausedAt: readStringFromKeys(value, [
      'paused_at',
      'pausedAt',
      'quota_paused_at',
      'quotaPausedAt',
    ]),
    pauseReason: readStringFromKeys(value, [
      'pause_reason',
      'pauseReason',
      'quota_pause_reason',
      'quotaPauseReason',
    ]),
    unpricedRecords:
      readNumberFromKeys(value, [
        'unpriced_records',
        'unpricedRecords',
        'quota_unpriced_records',
      ]) ?? 0,
    canCreateKeys: readBooleanFromKeys(value, ['can_create_keys', 'canCreateKeys']),
    raw: value,
  }
}

function normalizeUsage(record: UnknownRecord): UserUsageSummary {
  const usage = readRecordFromKeys(record, ['usage', 'usage_summary', 'usageSummary']) ?? record

  return {
    todayRecords:
      readNumberFromKeys(usage, ['today_records', 'todayRecords', 'records', 'request_count']) ?? 0,
    todayTotalTokens:
      readNumberFromKeys(usage, [
        'today_total_tokens',
        'todayTotalTokens',
        'total_tokens',
        'totalTokens',
      ]) ?? 0,
    todayEstimatedCostUsd:
      readNumberFromKeys(usage, [
        'today_estimated_cost_usd',
        'todayEstimatedCostUsd',
        'estimated_cost_usd',
        'estimatedCostUsd',
      ]) ?? 0,
    successRate: readNumberFromKeys(usage, ['success_rate', 'successRate']),
    rpm: readNumberFromKeys(usage, ['rpm', 'avg_rpm', 'avgRpm']),
    tpm: readNumberFromKeys(usage, ['tpm', 'avg_tpm', 'avgTpm']),
  }
}

function normalizeUser(record: UnknownRecord, index: number): UserResource {
  const numericId = readNumberFromKeys(record, ['id', 'user_id', 'userId'])
  const id =
    readStringFromKeys(record, ['id', 'user_id', 'userId', 'uuid']) ??
    (numericId !== null ? String(numericId) : `user-${index + 1}`)
  const username =
    readStringFromKeys(record, ['username', 'name', 'email', 'user_name', 'userName']) ?? id
  const nickname = readStringFromKeys(record, ['nickname', 'display_name', 'displayName', 'label'])
  const role = normalizeRole(record)
  const disabledAt = readStringFromKeys(record, ['disabled_at', 'disabledAt'])
  const disabled =
    readBooleanFromKeys(record, ['disabled', 'is_disabled', 'isDisabled']) ?? Boolean(disabledAt)
  const quota = normalizeQuota(readRecordFromKeys(record, ['quota', 'balance', 'billing']))

  return {
    id,
    numericId,
    username,
    nickname,
    label: nickname ?? username,
    role,
    isAdmin: role === 'admin',
    disabled,
    disabledAt,
    createdAt: readStringFromKeys(record, ['created_at', 'createdAt']),
    updatedAt: readStringFromKeys(record, ['updated_at', 'updatedAt']),
    keyCount:
      readNumberFromKeys(record, ['key_count', 'keyCount', 'api_key_count', 'apiKeyCount']) ?? 0,
    usage: normalizeUsage(record),
    quota,
    raw: record,
  }
}

function toUserPayload(input: UserFormInput) {
  return {
    username: input.username.trim(),
    nickname: input.nickname.trim() || undefined,
    role: input.role,
    is_admin: input.role === 'admin',
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

export async function enableUser(session: ManagementSessionInput, user: UserResource) {
  const client = createManagementClient(session)
  await client.post(`/users/${encodeURIComponent(user.id)}/enable`)
}

export async function disableUser(session: ManagementSessionInput, user: UserResource) {
  const client = createManagementClient(session)
  await client.post(`/users/${encodeURIComponent(user.id)}/disable`)
}

export function toUserApiError(error: unknown) {
  const apiError = toManagementApiError(error)
  return new Error(apiError.message, { cause: error })
}
