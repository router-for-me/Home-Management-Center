import { type UserSessionInput, createUserClient, toUserApiError } from '@/lib/api/user/client'

type UnknownRecord = Record<string, unknown>

type UserBillingRankItem = {
  id: string
  label: string
  amount: number
  requestCount: number
}

type UserBillingOverview = {
  currentBalance: number
  todaySpend: number
  monthSpend: number
  topModels: UserBillingRankItem[]
}

type UserBillingChargeRecord = {
  id: string
  createdAt: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  amount: number
  balanceAfter: number
  raw: unknown
}

export type UserBillingFilters = {
  from: string
  to: string
}

export type UserBillingPagination = {
  limit: number
  offset: number
}

type UserBillingPage<T> = {
  items: T[]
  total: number
  limit: number
  offset: number
  fetchedAt: string
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
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function readArrayRecords(value: unknown, keys: string[]) {
  if (Array.isArray(value)) return value.filter(isRecord)

  const record = toRecord(value)
  for (const key of keys) {
    const nextValue = record[key]
    if (Array.isArray(nextValue)) return nextValue.filter(isRecord)
  }

  return []
}

function compactParams(filters: UserBillingFilters, pagination?: UserBillingPagination) {
  return {
    from: filters.from || undefined,
    to: filters.to || undefined,
    limit: pagination?.limit,
    offset: pagination?.offset,
  }
}

function normalizeRankItem(value: unknown, index: number): UserBillingRankItem {
  const record = toRecord(value)
  const id = readString(record, ['id', 'model', 'provider']) ?? `rank-${index + 1}`

  return {
    id,
    label: readString(record, ['label', 'model', 'provider', 'name']) ?? id,
    amount: readNumber(record, ['amount', 'charge_amount', 'chargeAmount', 'cost']) ?? 0,
    requestCount: readNumber(record, ['request_count', 'requestCount', 'requests']) ?? 0,
  }
}

function normalizeOverview(value: unknown): UserBillingOverview {
  const record = toRecord(value)
  const overview = isRecord(record.overview) ? record.overview : record

  return {
    currentBalance:
      readNumber(overview, ['current_balance', 'currentBalance', 'balance', 'credits']) ?? 0,
    todaySpend: readNumber(overview, ['today_spend', 'todaySpend', 'today_charge']) ?? 0,
    monthSpend: readNumber(overview, ['month_spend', 'monthSpend', 'monthly_charge']) ?? 0,
    topModels: readArrayRecords(overview.top_models ?? overview.topModels, []).map(
      normalizeRankItem,
    ),
  }
}

function normalizeChargeRecord(value: unknown, index: number): UserBillingChargeRecord {
  const record = toRecord(value)
  const id = readString(record, ['id', 'request_id', 'requestId']) ?? `user-charge-${index + 1}`

  return {
    id,
    createdAt: readString(record, ['created_at', 'createdAt', 'time']) ?? '',
    provider: readString(record, ['provider']) ?? '',
    model: readString(record, ['model', 'model_id', 'modelId']) ?? '',
    inputTokens: readNumber(record, ['input_tokens', 'inputTokens']) ?? 0,
    outputTokens: readNumber(record, ['output_tokens', 'outputTokens']) ?? 0,
    amount: readNumber(record, ['amount', 'charge_amount', 'chargeAmount']) ?? 0,
    balanceAfter: readNumber(record, ['balance_after', 'balanceAfter']) ?? 0,
    raw: value,
  }
}

function normalizePage<T>(
  value: unknown,
  pagination: UserBillingPagination,
  normalize: (item: unknown, index: number) => T,
): UserBillingPage<T> {
  const record = toRecord(value)
  const items = readArrayRecords(value, ['items', 'records', 'data', 'charges']).map(normalize)

  return {
    items,
    total: readNumber(record, ['total']) ?? items.length,
    limit: readNumber(record, ['limit']) ?? pagination.limit,
    offset: readNumber(record, ['offset']) ?? pagination.offset,
    fetchedAt: new Date().toISOString(),
  }
}

function toUserBillingError(error: unknown) {
  const apiError = toUserApiError(error)
  return new Error(apiError.message, { cause: error })
}

export async function fetchUserBillingOverview(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
  filters: UserBillingFilters,
) {
  const client = createUserClient(session)

  try {
    const response = await client.get<unknown>('/billing/overview', {
      params: compactParams(filters),
    })

    return {
      fetchedAt: new Date().toISOString(),
      overview: normalizeOverview(response.data),
    }
  } catch (error) {
    throw toUserBillingError(error)
  }
}

export async function fetchUserBillingCharges(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
  filters: UserBillingFilters,
  pagination: UserBillingPagination,
) {
  const client = createUserClient(session)

  try {
    const response = await client.get<unknown>('/billing/charges', {
      params: compactParams(filters, pagination),
    })

    return normalizePage(response.data, pagination, normalizeChargeRecord)
  } catch (error) {
    throw toUserBillingError(error)
  }
}
