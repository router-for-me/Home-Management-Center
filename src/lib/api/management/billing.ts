import type {
  BalanceOperationInput,
  BalanceRecord,
  BalanceRecordType,
  BillingFilters,
  BillingOverview,
  BillingPage,
  BillingPagination,
  BillingRankItem,
  BillingTrendPoint,
  ChargeRecord,
  ModelPrice,
  ModelPriceInput,
  ModelPriceSnapshot,
  ModelPriceSource,
} from '@/lib/api/management/billing-types'
import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

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

function readBoolean(record: UnknownRecord, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
  }
  return fallback
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

function readPageRecords(value: unknown) {
  return readArrayRecords(value, ['items', 'records', 'data', 'charges', 'balance_records'])
}

function isPositiveIntegerText(value: string) {
  return /^[1-9]\d*$/.test(value.trim())
}

function compactParams(filters: BillingFilters, pagination?: BillingPagination) {
  const user = filters.user.trim()

  return {
    from: filters.from || undefined,
    to: filters.to || undefined,
    user: user || undefined,
    user_id: isPositiveIntegerText(user) ? user : undefined,
    provider: filters.provider.trim() || undefined,
    model: filters.model.trim() || undefined,
    limit: pagination?.limit,
    offset: pagination?.offset,
  }
}

function normalizeRankItem(value: unknown, index: number): BillingRankItem {
  const record = toRecord(value)
  const id =
    readString(record, ['id', 'user_id', 'userId', 'model', 'provider']) ?? `rank-${index + 1}`

  return {
    id,
    label: readString(record, ['label', 'username', 'model', 'provider', 'name']) ?? id,
    amount: readNumber(record, ['amount', 'charge_amount', 'chargeAmount', 'cost']) ?? 0,
    requestCount: readNumber(record, ['request_count', 'requestCount', 'requests']) ?? 0,
  }
}

function normalizeTrendPoint(value: unknown): BillingTrendPoint {
  const record = toRecord(value)

  return {
    date: readString(record, ['date', 'day', 'time', 'created_at', 'createdAt']) ?? '',
    chargeAmount: readNumber(record, ['charge_amount', 'chargeAmount', 'amount']) ?? 0,
    requestCount: readNumber(record, ['request_count', 'requestCount', 'requests']) ?? 0,
  }
}

function normalizeOverview(value: unknown, filters: BillingFilters): BillingOverview {
  const record = toRecord(value)
  const overview = isRecord(record.overview) ? record.overview : record

  return {
    range: {
      from: readString(overview, ['from', 'range_from', 'rangeFrom']) ?? filters.from,
      to: readString(overview, ['to', 'range_to', 'rangeTo']) ?? filters.to,
    },
    totalChargeAmount:
      readNumber(overview, ['total_charge_amount', 'totalChargeAmount', 'charge_amount']) ?? 0,
    totalRechargeAmount:
      readNumber(overview, ['total_recharge_amount', 'totalRechargeAmount', 'recharge_amount']) ??
      0,
    totalDeductAmount:
      readNumber(overview, ['total_deduct_amount', 'totalDeductAmount', 'deduct_amount']) ?? 0,
    totalBalance: readNumber(overview, ['total_balance', 'totalBalance', 'balance']) ?? 0,
    requestCount: readNumber(overview, ['request_count', 'requestCount', 'requests']) ?? 0,
    inputTokens: readNumber(overview, ['input_tokens', 'inputTokens']) ?? 0,
    outputTokens: readNumber(overview, ['output_tokens', 'outputTokens']) ?? 0,
    cacheTokens: readNumber(overview, ['cache_tokens', 'cacheTokens']) ?? 0,
    activeUserCount: readNumber(overview, ['active_user_count', 'activeUserCount']) ?? 0,
    dailyTrend: readArrayRecords(overview.daily_trend ?? overview.dailyTrend, []).map(
      normalizeTrendPoint,
    ),
    topUsers: readArrayRecords(overview.top_users ?? overview.topUsers, []).map(normalizeRankItem),
    topModels: readArrayRecords(overview.top_models ?? overview.topModels, []).map(
      normalizeRankItem,
    ),
    topProviders: readArrayRecords(overview.top_providers ?? overview.topProviders, []).map(
      normalizeRankItem,
    ),
  }
}

function normalizePriceSnapshot(value: unknown): ModelPriceSnapshot {
  const record = toRecord(value)

  return {
    provider: readString(record, ['provider']) ?? '',
    model: readString(record, ['model', 'model_id', 'modelId']) ?? '',
    inputPricePerMillion:
      readNumber(record, ['input_price_per_million', 'inputPricePerMillion']) ?? 0,
    outputPricePerMillion:
      readNumber(record, ['output_price_per_million', 'outputPricePerMillion']) ?? 0,
    cacheReadPricePerMillion:
      readNumber(record, ['cache_read_price_per_million', 'cacheReadPricePerMillion']) ?? 0,
    cacheWritePricePerMillion:
      readNumber(record, ['cache_write_price_per_million', 'cacheWritePricePerMillion']) ?? 0,
    requestPrice: readNumber(record, ['request_price', 'requestPrice']) ?? 0,
    raw: value,
  }
}

function normalizeChargeRecord(value: unknown, index: number): ChargeRecord {
  const record = toRecord(value)
  const requestId =
    readString(record, ['request_id', 'requestId']) ??
    readString(record, ['id']) ??
    `charge-${index + 1}`

  return {
    id: readString(record, ['id']) ?? requestId,
    createdAt: readString(record, ['created_at', 'createdAt', 'time']) ?? '',
    userId: readNumber(record, ['user_id', 'userId']),
    username: readString(record, ['username', 'user_name', 'userName']) ?? '',
    apiKeyLabel: readString(record, ['api_key_label', 'apiKeyLabel', 'key_label']) ?? '',
    apiKeyMasked: readString(record, ['api_key_masked', 'apiKeyMasked', 'masked_key']) ?? '',
    provider: readString(record, ['provider']) ?? '',
    model: readString(record, ['model']) ?? '',
    originalModel: readString(record, ['original_model', 'originalModel']),
    actualModel: readString(record, ['actual_model', 'actualModel', 'response_model']),
    requestId,
    endpoint: readString(record, ['endpoint']),
    inputTokens: readNumber(record, ['input_tokens', 'inputTokens']) ?? 0,
    outputTokens: readNumber(record, ['output_tokens', 'outputTokens']) ?? 0,
    cacheTokens: readNumber(record, ['cache_tokens', 'cacheTokens']) ?? 0,
    amount: readNumber(record, ['amount', 'charge_amount', 'chargeAmount']) ?? 0,
    balanceBefore: readNumber(record, ['balance_before', 'balanceBefore']) ?? 0,
    balanceAfter: readNumber(record, ['balance_after', 'balanceAfter']) ?? 0,
    matchedPriceRule: readString(record, [
      'matched_price_rule',
      'matchedPriceRule',
      'price_rule',
      'priceRule',
      'rule',
    ]),
    priceSnapshot: normalizePriceSnapshot(record.price_snapshot ?? record.priceSnapshot),
    requestSummary: readString(record, ['request_summary', 'requestSummary', 'summary']),
    raw: value,
  }
}

function normalizeBalanceRecordType(value: string | null): BalanceRecordType {
  return value === 'deduct' || value === 'deduction' ? 'deduct' : 'recharge'
}

function normalizeBalanceRecord(value: unknown, index: number): BalanceRecord {
  const record = toRecord(value)

  return {
    id: readString(record, ['id']) ?? `balance-${index + 1}`,
    createdAt: readString(record, ['created_at', 'createdAt', 'time']) ?? '',
    userId: readNumber(record, ['user_id', 'userId']),
    username: readString(record, ['username', 'user_name', 'userName']) ?? '',
    type: normalizeBalanceRecordType(readString(record, ['type', 'operation'])),
    amount: readNumber(record, ['amount', 'amount_delta', 'amountDelta']) ?? 0,
    balanceBefore: readNumber(record, ['balance_before', 'balanceBefore']) ?? 0,
    balanceAfter: readNumber(record, ['balance_after', 'balanceAfter']) ?? 0,
    operator: readString(record, ['operator', 'admin', 'operator_name', 'operatorName']) ?? '',
    note: readString(record, ['note', 'remark', 'reason']) ?? '',
    raw: value,
  }
}

function normalizeModelPriceSource(value: string | null): ModelPriceSource {
  if (value === 'default' || value === 'sync') return value
  return 'manual'
}

function normalizeModelPrice(value: unknown, index: number): ModelPrice {
  const record = toRecord(value)
  const provider = readString(record, ['provider']) ?? ''
  const model = readString(record, ['model', 'model_id', 'modelId']) ?? ''
  const naturalId = provider || model ? `${provider}:${model}` : `price-${index + 1}`

  return {
    id: readString(record, ['id']) ?? naturalId,
    provider,
    model,
    inputPricePerMillion:
      readNumber(record, ['input_price_per_million', 'inputPricePerMillion']) ?? 0,
    outputPricePerMillion:
      readNumber(record, ['output_price_per_million', 'outputPricePerMillion']) ?? 0,
    cacheReadPricePerMillion:
      readNumber(record, ['cache_read_price_per_million', 'cacheReadPricePerMillion']) ?? 0,
    cacheWritePricePerMillion:
      readNumber(record, ['cache_write_price_per_million', 'cacheWritePricePerMillion']) ?? 0,
    requestPrice: readNumber(record, ['request_price', 'requestPrice']) ?? 0,
    source: normalizeModelPriceSource(readString(record, ['source'])),
    enabled: readBoolean(record, ['enabled'], true),
    note: readString(record, ['note']),
    updatedAt: readString(record, ['updated_at', 'updatedAt']) ?? '',
    raw: value,
  }
}

function normalizePage<T>(
  value: unknown,
  pagination: BillingPagination,
  normalize: (item: unknown, index: number) => T,
): BillingPage<T> {
  const record = toRecord(value)
  const items = readPageRecords(value).map(normalize)

  return {
    items,
    total: readNumber(record, ['total']) ?? items.length,
    limit: readNumber(record, ['limit']) ?? pagination.limit,
    offset: readNumber(record, ['offset']) ?? pagination.offset,
    fetchedAt: new Date().toISOString(),
  }
}

function toBalanceOperationPayload(input: BalanceOperationInput) {
  return {
    user_id: input.userId,
    amount: input.amount,
    note: input.note.trim(),
  }
}

function toModelPricePayload(input: ModelPriceInput) {
  return {
    provider: input.provider.trim(),
    model: input.model.trim(),
    input_price_per_million: input.inputPricePerMillion,
    output_price_per_million: input.outputPricePerMillion,
    cache_read_price_per_million: input.cacheReadPricePerMillion,
    cache_write_price_per_million: input.cacheWritePricePerMillion,
    request_price: input.requestPrice,
    enabled: input.enabled,
    note: input.note?.trim() || undefined,
    source: input.source,
  }
}

export async function fetchBillingOverview(
  session: ManagementSessionInput,
  filters: BillingFilters,
) {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/billing/overview', {
    params: compactParams(filters),
  })

  return {
    fetchedAt: new Date().toISOString(),
    overview: normalizeOverview(response.data, filters),
  }
}

export async function fetchChargeRecords(
  session: ManagementSessionInput,
  filters: BillingFilters,
  pagination: BillingPagination,
) {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/billing/charges', {
    params: compactParams(filters, pagination),
  })

  return normalizePage(response.data, pagination, normalizeChargeRecord)
}

export async function fetchBalanceRecords(
  session: ManagementSessionInput,
  filters: BillingFilters,
  pagination: BillingPagination,
) {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/billing/balance-records', {
    params: compactParams(filters, pagination),
  })

  return normalizePage(response.data, pagination, normalizeBalanceRecord)
}

export async function createRecharge(
  session: ManagementSessionInput,
  input: BalanceOperationInput,
) {
  const client = createManagementClient(session)
  await client.post('/billing/balance-records/recharge', toBalanceOperationPayload(input))
}

export async function createDeduction(
  session: ManagementSessionInput,
  input: BalanceOperationInput,
) {
  const client = createManagementClient(session)
  await client.post('/billing/balance-records/deduct', toBalanceOperationPayload(input))
}

export async function fetchModelPrices(
  session: ManagementSessionInput,
  filters: Pick<BillingFilters, 'provider' | 'model'>,
) {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/billing/model-prices', {
    params: {
      provider: filters.provider.trim() || undefined,
      model: filters.model.trim() || undefined,
    },
  })

  return {
    fetchedAt: new Date().toISOString(),
    items: readArrayRecords(response.data, ['items', 'records', 'data', 'prices']).map(
      normalizeModelPrice,
    ),
  }
}

export async function createModelPrice(session: ManagementSessionInput, input: ModelPriceInput) {
  const client = createManagementClient(session)
  await client.post('/billing/model-prices', toModelPricePayload(input))
}

export async function updateModelPrice(
  session: ManagementSessionInput,
  resource: ModelPrice,
  input: ModelPriceInput,
) {
  const client = createManagementClient(session)
  await client.patch(
    `/billing/model-prices/${encodeURIComponent(resource.id)}`,
    toModelPricePayload(input),
  )
}

export async function deleteModelPrice(session: ManagementSessionInput, resource: ModelPrice) {
  const client = createManagementClient(session)
  await client.delete(`/billing/model-prices/${encodeURIComponent(resource.id)}`)
}

export function toBillingApiError(error: unknown) {
  const apiError = toManagementApiError(error)
  return new Error(apiError.message, { cause: error })
}
