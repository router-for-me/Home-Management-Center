import axios from 'axios'

import type {
  BalanceOperationInput,
  BalanceRecord,
  BalanceRecordType,
  BillingFilters,
  BillingOverview,
  BillingPage,
  BillingPagination,
  BillingRankItem,
  BillingSettings,
  BillingSettingsUpdate,
  BillingTierDiagnostics,
  BillingTrendPoint,
  ChargeRecord,
  ModelPrice,
  ModelPriceInput,
  ModelPriceSnapshot,
  ModelPriceSource,
} from './billing-types'
import { createManagementClient, toManagementApiError } from './client'
import type { ManagementSessionInput } from './types'

type UnknownRecord = Record<string, unknown>

const billingOverviewContractError = 'billing_overview_contract_invalid'

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

export function toBillingQueryParams(filters: BillingFilters, pagination?: BillingPagination) {
  const user = filters.user.trim()
  const from = filters.from.trim()
  const to = filters.to.trim()

  return {
    from: from || undefined,
    to: to || undefined,
    timezone: filters.timezone,
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

function normalizeBillingRange(value: unknown) {
  if (!isRecord(value)) {
    throw new Error(billingOverviewContractError)
  }

  const from = value.from
  const to = value.to
  const hasFromAt = 'from_at' in value || 'fromAt' in value
  const hasToAtExclusive = 'to_at_exclusive' in value || 'toAtExclusive' in value
  const fromAt = 'from_at' in value ? value.from_at : value.fromAt
  const toAtExclusive = 'to_at_exclusive' in value ? value.to_at_exclusive : value.toAtExclusive
  const timezone = value.timezone
  if (
    typeof from !== 'string' ||
    typeof to !== 'string' ||
    !hasFromAt ||
    !hasToAtExclusive ||
    (fromAt !== null && (typeof fromAt !== 'string' || !fromAt.trim())) ||
    (toAtExclusive !== null && (typeof toAtExclusive !== 'string' || !toAtExclusive.trim())) ||
    typeof timezone !== 'string' ||
    !timezone.trim()
  ) {
    throw new Error(billingOverviewContractError)
  }

  return {
    from: from.trim(),
    to: to.trim(),
    fromAt: typeof fromAt === 'string' ? fromAt.trim() : null,
    toAtExclusive: typeof toAtExclusive === 'string' ? toAtExclusive.trim() : null,
    timezone: timezone.trim(),
  }
}

export function normalizeBillingOverview(value: unknown): BillingOverview {
  const record = toRecord(value)
  if (!isRecord(record.overview)) {
    throw new Error(billingOverviewContractError)
  }
  const overview = record.overview

  return {
    range: normalizeBillingRange(overview.range),
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

export function normalizePriceSnapshot(value: unknown): ModelPriceSnapshot {
  const record = toRecord(value)
  const source = readString(record, ['service_tier_source', 'serviceTierSource'])
  const tokenBucketsRecord = toRecord(record.token_buckets ?? record.tokenBuckets)
  return {
    schemaVersion: readNumber(record, ['schema_version', 'schemaVersion']),
    provider: readString(record, ['provider']) ?? '',
    model: readString(record, ['model', 'model_id', 'modelId']) ?? '',
    serviceTier: readString(record, ['service_tier', 'serviceTier']) ?? '',
    minInputTokens: readNumber(record, ['min_input_tokens', 'minInputTokens']) ?? 0,
    inputPricePerMillion:
      readNumber(record, ['input_price_per_million', 'inputPricePerMillion']) ?? 0,
    outputPricePerMillion:
      readNumber(record, ['output_price_per_million', 'outputPricePerMillion']) ?? 0,
    cacheReadPricePerMillion:
      readNumber(record, ['cache_read_price_per_million', 'cacheReadPricePerMillion']) ?? 0,
    cacheWritePricePerMillion:
      readNumber(record, ['cache_write_price_per_million', 'cacheWritePricePerMillion']) ?? 0,
    requestPrice: readNumber(record, ['request_price', 'requestPrice']) ?? 0,
    requestedServiceTier: readString(record, ['requested_service_tier', 'requestedServiceTier']),
    responseServiceTier: readString(record, ['response_service_tier', 'responseServiceTier']),
    serviceTierSource: source === 'request' || source === 'response' ? source : null,
    effectiveServiceTier: readString(record, ['effective_service_tier', 'effectiveServiceTier']),
    responseServiceTierFallback:
      typeof record.response_service_tier_fallback === 'boolean'
        ? record.response_service_tier_fallback
        : typeof record.responseServiceTierFallback === 'boolean'
          ? record.responseServiceTierFallback
          : null,
    inputTokensForBand: readNumber(record, ['input_tokens_for_band', 'inputTokensForBand']) ?? 0,
    uncachedInputTokens:
      readNumber(record, ['uncached_input_tokens', 'uncachedInputTokens']) ??
      readNumber(tokenBucketsRecord, ['uncached_input', 'uncachedInput']) ??
      0,
    cacheReadTokens:
      readNumber(record, ['cache_read_tokens', 'cacheReadTokens']) ??
      readNumber(tokenBucketsRecord, ['cache_read', 'cacheRead']) ??
      0,
    cacheWriteTokens:
      readNumber(record, ['cache_write_tokens', 'cacheWriteTokens']) ??
      readNumber(tokenBucketsRecord, ['cache_write', 'cacheWrite']) ??
      0,
    outputTokens:
      readNumber(record, ['output_tokens', 'outputTokens']) ??
      readNumber(tokenBucketsRecord, ['output']) ??
      0,
    tokenBuckets:
      Object.keys(tokenBucketsRecord).length > 0
        ? {
            uncachedInput: readNumber(tokenBucketsRecord, ['uncached_input', 'uncachedInput']) ?? 0,
            cacheRead: readNumber(tokenBucketsRecord, ['cache_read', 'cacheRead']) ?? 0,
            cacheWrite: readNumber(tokenBucketsRecord, ['cache_write', 'cacheWrite']) ?? 0,
            output: readNumber(tokenBucketsRecord, ['output']) ?? 0,
          }
        : null,
    cacheWriteSource: readString(record, ['cache_write_source', 'cacheWriteSource']),
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
    cacheReadTokens: readNumber(record, ['cache_read_tokens', 'cacheReadTokens']),
    cacheWriteTokens: readNumber(record, ['cache_write_tokens', 'cacheWriteTokens']),
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
  const serviceTier = readString(record, ['service_tier', 'serviceTier']) ?? '*'
  const minInputTokens = readNumber(record, ['min_input_tokens', 'minInputTokens']) ?? 0
  const naturalId =
    provider || model
      ? `${provider}:${model}:${serviceTier}:${minInputTokens}`
      : `price-${index + 1}`

  return {
    id: readString(record, ['id']) ?? naturalId,
    provider,
    model,
    serviceTier,
    minInputTokens,
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

export function toModelPricePayload(input: ModelPriceInput) {
  return {
    provider: input.provider.trim(),
    model: input.model.trim(),
    ...(input.serviceTier === undefined ? {} : { service_tier: input.serviceTier.trim() || '*' }),
    ...(input.minInputTokens === undefined ? {} : { min_input_tokens: input.minInputTokens }),
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
    params: toBillingQueryParams(filters),
  })

  return {
    fetchedAt: new Date().toISOString(),
    overview: normalizeBillingOverview(response.data),
  }
}

export async function fetchChargeRecords(
  session: ManagementSessionInput,
  filters: BillingFilters,
  pagination: BillingPagination,
) {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/billing/charges', {
    params: toBillingQueryParams(filters, pagination),
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
    params: toBillingQueryParams(filters, pagination),
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

  return normalizeModelPriceListResponse(response.data)
}

export function normalizeModelPriceListResponse(value: unknown) {
  const record = toRecord(value)
  return {
    fetchedAt: new Date().toISOString(),
    schemaVersion: readNumber(record, [
      'price_rule_schema_version',
      'priceRuleSchemaVersion',
      'schema_version',
    ]),
    items: readArrayRecords(value, ['items', 'records', 'data', 'prices']).map(normalizeModelPrice),
  }
}

export async function fetchBillingSettings(
  session: ManagementSessionInput,
): Promise<BillingSettings> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/billing/settings')
  const record = toRecord(response.data)
  return normalizeBillingSettingsResponse(record, response.data)
}

export function normalizeBillingSettingsResponse(
  record: UnknownRecord,
  raw: unknown = record,
): BillingSettings {
  const source = readString(record, ['service_tier_source', 'serviceTierSource'])
  const reportTimezone = readString(record, ['report_timezone', 'reportTimezone'])
  if (!reportTimezone) throw new Error('billing_settings_contract_invalid')
  return {
    serviceTierSource: source === 'response' ? 'response' : 'request',
    reportTimezone,
    supported: true,
    raw,
  }
}

export async function updateBillingSettings(
  session: ManagementSessionInput,
  input: BillingSettingsUpdate,
): Promise<BillingSettings> {
  const client = createManagementClient(session)
  const response = await client.patch<unknown>('/billing/settings', {
    ...(input.serviceTierSource ? { service_tier_source: input.serviceTierSource } : {}),
    ...(input.reportTimezone ? { report_timezone: input.reportTimezone.trim() } : {}),
  })
  const record = toRecord(response.data)
  return normalizeBillingSettingsResponse(record, response.data)
}

export async function fetchBillingTierDiagnostics(
  session: ManagementSessionInput,
): Promise<BillingTierDiagnostics> {
  const client = createManagementClient(session)
  try {
    const response = await client.get<unknown>('/billing/settings/diagnostics')
    const record = toRecord(response.data)
    return {
      supported: readBoolean(record, ['supported'], true),
      windowStart: readString(record, ['window_start', 'windowStart']),
      windowEnd: readString(record, ['window_end', 'windowEnd']),
      eligibleRequests: readNumber(record, ['eligible_requests', 'eligibleRequests']) ?? 0,
      responseTierRequests:
        readNumber(record, ['response_tier_requests', 'responseTierRequests']) ?? 0,
      fallbackRequests: readNumber(record, ['fallback_requests', 'fallbackRequests']) ?? 0,
      lastResponseTierAt: readString(record, ['last_response_tier_at', 'lastResponseTierAt']),
    }
  } catch (error) {
    if (axios.isAxiosError(error) && [404, 405].includes(error.response?.status ?? 0)) {
      return {
        supported: false,
        windowStart: null,
        windowEnd: null,
        eligibleRequests: 0,
        responseTierRequests: 0,
        fallbackRequests: 0,
        lastResponseTierAt: null,
      }
    }
    throw error
  }
}

export async function createModelPrice(session: ManagementSessionInput, input: ModelPriceInput) {
  const client = createManagementClient(session)
  const response = await client.post<unknown>('/billing/model-prices', toModelPricePayload(input))
  const root = toRecord(response.data)
  const resource = isRecord(root.model_price) ? root.model_price : root
  return readString(resource, ['id'])
}

export async function updateModelPrice(
  session: ManagementSessionInput,
  resource: ModelPrice,
  input: ModelPriceInput,
) {
  const client = createManagementClient(session)
  const response = await client.patch<unknown>(
    `/billing/model-prices/${encodeURIComponent(resource.id)}`,
    toModelPricePayload(input),
  )
  const root = toRecord(response.data)
  const updated = isRecord(root.model_price) ? root.model_price : root
  return readString(updated, ['id']) ?? resource.id
}

export async function deleteModelPrice(session: ManagementSessionInput, resource: ModelPrice) {
  const client = createManagementClient(session)
  await client.delete(`/billing/model-prices/${encodeURIComponent(resource.id)}`)
}

export function toBillingApiError(error: unknown) {
  const apiError = toManagementApiError(error)
  return new Error(apiError.message, { cause: error })
}
