import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type UserPeriodWindowId = '5h' | '1d' | '7d' | '30d'
export type UserPeriodWindowMode = 'first_use' | 'sliding' | 'calendar'
export type UserPeriodResetMode = 'counter' | 'window_only'

export const userPeriodWindowIds: UserPeriodWindowId[] = ['5h', '1d', '7d', '30d']

export const defaultUserPeriodTimezone = 'Asia/Shanghai'
export const defaultUserPeriodWeekResetDay = 1
export const defaultUserPeriodWeekResetHour = 0

export type UserPeriodWindowConfig = {
  limit: number | null
  mode: UserPeriodWindowMode
}

export type UserPeriodLimitsConfig = {
  supported: boolean
  creditsUnlimited: boolean
  timezone: string
  windows: Record<UserPeriodWindowId, UserPeriodWindowConfig>
  weekResetDay: number
  weekResetHour: number
}

export type UserPeriodLimitsSummary = {
  enabledWindows: UserPeriodWindowId[]
  zeroLimitWindows: UserPeriodWindowId[]
}

export type UserResource = {
  id: string
  numericId: number | null
  username: string
  hasPassword: boolean
  credits: number
  creditsUnlimited: boolean
  periodLimits: UserPeriodLimitsConfig
  periodLimitsSummary: UserPeriodLimitsSummary | null
  mfaConfigured: boolean
  passkeyCount: number
  deletedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  raw: unknown
}

export type UserPeriodLimitsInput = {
  creditsUnlimited: boolean
  timezone: string
  windows: Record<UserPeriodWindowId, UserPeriodWindowConfig>
  weekResetDay: number
  weekResetHour: number
}

export type UserFormInput = {
  username: string
  password?: string
  credits?: number
  periodLimits?: UserPeriodLimitsInput
}

export type UserPeriodWindowStatus = {
  id: UserPeriodWindowId
  enabled: boolean
  limit: number | null
  used: number
  remaining: number | null
  mode: UserPeriodWindowMode
  active: boolean
  windowStart: string | null
  windowEnd: string | null
  resetAt: string | null
  usageEpoch: string | null
}

export type UserPeriodLimitsStatus = {
  userId: number | null
  timezone: string
  credits: number
  creditsUnlimited: boolean
  windows: UserPeriodWindowStatus[]
  fetchedAt: string
}

export type UserPeriodResetInput = {
  windows: UserPeriodWindowId[]
  mode: UserPeriodResetMode
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

function readBoolean(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
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

function normalizeWindowMode(value: unknown, allowCalendar: boolean): UserPeriodWindowMode {
  if (typeof value !== 'string') return 'first_use'

  const normalized = value.trim().toLowerCase()
  if (normalized === 'sliding' || normalized === 'rolling') return 'sliding'
  if (normalized === 'calendar') return allowCalendar ? 'calendar' : 'first_use'

  return 'first_use'
}

function normalizePeriodLimits(record: UnknownRecord): UserPeriodLimitsConfig {
  const supported = 'credits_unlimited' in record || 'limit_5h_credits' in record
  const readLimit = (key: string) => {
    const value = record[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  return {
    supported,
    creditsUnlimited: readBoolean(record, ['credits_unlimited', 'creditsUnlimited']) ?? false,
    timezone:
      readString(record, ['timezone', 'time_zone']) ?? (supported ? defaultUserPeriodTimezone : ''),
    windows: {
      '5h': {
        limit: readLimit('limit_5h_credits'),
        mode: normalizeWindowMode(record.window_mode_5h, false),
      },
      '1d': {
        limit: readLimit('limit_1d_credits'),
        mode: normalizeWindowMode(record.window_mode_1d, true),
      },
      '7d': {
        limit: readLimit('limit_7d_credits'),
        mode: normalizeWindowMode(record.window_mode_7d, true),
      },
      '30d': {
        limit: readLimit('limit_30d_credits'),
        mode: normalizeWindowMode(record.window_mode_30d, true),
      },
    },
    weekResetDay:
      readNumber(record, ['week_reset_day', 'weekResetDay']) ?? defaultUserPeriodWeekResetDay,
    weekResetHour:
      readNumber(record, ['week_reset_hour', 'weekResetHour']) ?? defaultUserPeriodWeekResetHour,
  }
}

function normalizeWindowIdList(value: unknown): UserPeriodWindowId[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is UserPeriodWindowId =>
      item === '5h' || item === '1d' || item === '7d' || item === '30d',
  )
}

function normalizePeriodLimitsSummary(value: unknown): UserPeriodLimitsSummary | null {
  if (!isRecord(value)) return null

  return {
    enabledWindows: normalizeWindowIdList(value.enabled_windows ?? value.enabledWindows),
    zeroLimitWindows: normalizeWindowIdList(value.zero_limit_windows ?? value.zeroLimitWindows),
  }
}

function normalizeUser(record: UnknownRecord, index: number): UserResource {
  const numericId = readNumber(record, ['id', 'user_id', 'userId'])
  const id =
    readString(record, ['id', 'user_id', 'userId', 'uuid']) ??
    (numericId !== null ? String(numericId) : `user-${index + 1}`)
  const username = readString(record, ['username', 'user_name', 'userName', 'name']) ?? id
  const passkey = record.passkey
  const periodLimits = normalizePeriodLimits(record)

  return {
    id,
    numericId,
    username,
    hasPassword:
      readBoolean(record, ['password_set', 'passwordSet']) ??
      (typeof record.password === 'string' && record.password.length > 0),
    credits: readNumber(record, ['credits']) ?? 0,
    creditsUnlimited: periodLimits.creditsUnlimited,
    periodLimits,
    periodLimitsSummary: normalizePeriodLimitsSummary(record.period_limits_summary),
    mfaConfigured: hasStructuredValue(record.mfa),
    passkeyCount: Array.isArray(passkey) ? passkey.length : hasStructuredValue(passkey) ? 1 : 0,
    deletedAt: readString(record, ['deleted_at', 'deletedAt']),
    createdAt: readString(record, ['created_at', 'createdAt']),
    updatedAt: readString(record, ['updated_at', 'updatedAt']),
    raw: record,
  }
}

function toUserPayload(input: UserFormInput) {
  const periodLimits = input.periodLimits

  return {
    username: input.username.trim(),
    password: input.password?.trim() || undefined,
    credits: input.credits,
    ...(periodLimits
      ? {
          credits_unlimited: periodLimits.creditsUnlimited,
          timezone: periodLimits.timezone.trim() || undefined,
          limit_5h_credits: periodLimits.windows['5h'].limit,
          window_mode_5h: periodLimits.windows['5h'].mode,
          limit_1d_credits: periodLimits.windows['1d'].limit,
          window_mode_1d: periodLimits.windows['1d'].mode,
          limit_7d_credits: periodLimits.windows['7d'].limit,
          window_mode_7d: periodLimits.windows['7d'].mode,
          week_reset_day: periodLimits.weekResetDay,
          week_reset_hour: periodLimits.weekResetHour,
          limit_30d_credits: periodLimits.windows['30d'].limit,
          window_mode_30d: periodLimits.windows['30d'].mode,
        }
      : {}),
  }
}

function normalizeWindowStatus(record: UnknownRecord): UserPeriodWindowStatus | null {
  const id = readString(record, ['id', 'window'])
  if (id !== '5h' && id !== '1d' && id !== '7d' && id !== '30d') return null

  const enabled = readBoolean(record, ['enabled']) ?? false
  const rawLimit = record.limit
  const rawRemaining = record.remaining

  return {
    id,
    enabled,
    limit: typeof rawLimit === 'number' && Number.isFinite(rawLimit) ? rawLimit : null,
    used: readNumber(record, ['used']) ?? 0,
    remaining:
      typeof rawRemaining === 'number' && Number.isFinite(rawRemaining) ? rawRemaining : null,
    mode: normalizeWindowMode(record.mode, id !== '5h'),
    active: readBoolean(record, ['active']) ?? false,
    windowStart: readString(record, ['window_start', 'windowStart']),
    windowEnd: readString(record, ['window_end', 'windowEnd']),
    resetAt: readString(record, ['reset_at', 'resetAt']),
    usageEpoch: readString(record, ['usage_epoch', 'usageEpoch']),
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

function normalizePeriodLimitsStatus(record: UnknownRecord): UserPeriodLimitsStatus {
  const windows = readArrayRecords(record.windows)
    .map(normalizeWindowStatus)
    .filter((window): window is UserPeriodWindowStatus => window !== null)

  return {
    userId: readNumber(record, ['user_id', 'userId']),
    timezone: readString(record, ['timezone']) ?? defaultUserPeriodTimezone,
    credits: readNumber(record, ['credits']) ?? 0,
    creditsUnlimited: readBoolean(record, ['credits_unlimited', 'creditsUnlimited']) ?? false,
    windows: userPeriodWindowIds.map(
      (id) =>
        windows.find((window) => window.id === id) ?? {
          id,
          enabled: false,
          limit: null,
          used: 0,
          remaining: null,
          mode: 'first_use',
          active: false,
          windowStart: null,
          windowEnd: null,
          resetAt: null,
          usageEpoch: null,
        },
    ),
    fetchedAt: new Date().toISOString(),
  }
}

export async function fetchUserPeriodLimits(
  session: ManagementSessionInput,
  userId: string,
): Promise<UserPeriodLimitsStatus> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>(`/users/${encodeURIComponent(userId)}/period-limits`)

  return normalizePeriodLimitsStatus(toRecord(response.data))
}

export async function resetUserPeriodLimits(
  session: ManagementSessionInput,
  userId: string,
  input: UserPeriodResetInput,
): Promise<UserPeriodLimitsStatus | null> {
  const client = createManagementClient(session)
  const response = await client.post<unknown>(
    `/users/${encodeURIComponent(userId)}/period-limits/reset`,
    {
      windows: input.windows,
      mode: input.mode,
    },
  )
  const record = toRecord(response.data)

  return isRecord(record.limits) ? normalizePeriodLimitsStatus(record.limits) : null
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

export type UserApiFieldError = {
  field: string
  code: string
}

export function toUserApiError(error: unknown) {
  const apiError = toManagementApiError(error)
  const wrapped = new Error(apiError.message, { cause: error }) as Error & {
    fieldErrors?: UserApiFieldError[]
  }

  if (apiError.fieldErrors?.length) {
    wrapped.fieldErrors = apiError.fieldErrors
  }

  return wrapped
}

export function getUserApiFieldErrors(error: unknown): UserApiFieldError[] {
  if (!error || typeof error !== 'object' || !('fieldErrors' in error)) return []

  const value = (error as { fieldErrors?: unknown }).fieldErrors
  if (!Array.isArray(value)) return []

  return value.filter(
    (item): item is UserApiFieldError =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as UserApiFieldError).field === 'string' &&
      typeof (item as UserApiFieldError).code === 'string',
  )
}
