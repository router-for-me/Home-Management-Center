import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementApiError, ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type QuotaStatus = 'healthy' | 'low' | 'exhausted' | 'unknown' | 'error' | 'unsupported'

export type QuotaPlan = {
  name: string
  premium: boolean
}

export type QuotaFreshness = 'fresh' | 'stale' | 'never'
export type QuotaDataSource = 'response_header' | 'active_probe' | 'mixed' | 'none'
export type QuotaCollectionStatus =
  | 'idle'
  | 'collecting'
  | 'success'
  | 'partial'
  | 'failed'
  | 'unsupported'
export type QuotaCredentialStatus = 'enabled' | 'disabled' | 'unavailable' | 'cooldown' | 'unknown'
export type QuotaCredentialType = 'oauth' | 'provider_api_key' | 'file_auth' | 'vertex' | 'unknown'
export type QuotaWindowMode = 'rolling' | 'fixed' | 'balance' | 'unknown'
export type QuotaWindowScope = 'account' | 'project' | 'model' | 'organization' | 'unknown'
export type QuotaUnit = 'requests' | 'tokens' | 'credits' | 'currency' | 'percentage' | 'unknown'
export type QuotaWindowPeriodUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'unknown'
export type QuotaSort =
  | 'risk_desc'
  | 'observed_at_desc'
  | 'observed_at_asc'
  | 'reset_at_asc'
  | 'provider_asc'
  | 'label_asc'

export type QuotaWindow = {
  id: string
  label: string | null
  scope: QuotaWindowScope
  scopeId: string | null
  mode: QuotaWindowMode
  status: QuotaStatus
  unit: QuotaUnit
  currency: string | null
  used: number | null
  remaining: number | null
  limit: number | null
  usedRatio: number | null
  remainingRatio: number | null
  isUnlimited: boolean
  resetAt: string | null
  windowSeconds: number | null
  periodUnit: QuotaWindowPeriodUnit
  periodValue: number | null
  observedAt: string | null
  source: QuotaDataSource
}

export type QuotaCollectionError = {
  code: string | null
  message: string
  retryable: boolean
  occurredAt: string | null
  upstreamStatusCode: number | null
  requestId: string | null
}

export type QuotaRuntime = {
  homeId: string | null
  homeLabel: string | null
  cpaNodeId: string | null
  cpaNodeLabel: string | null
}

export type QuotaCredential = {
  id: string
  name: string
  authIndex: string | null
  provider: string
  credentialType: QuotaCredentialType
  account: string | null
  project: string | null
  credentialStatus: QuotaCredentialStatus
  status: QuotaStatus
  freshness: QuotaFreshness
  source: QuotaDataSource
  collectionStatus: QuotaCollectionStatus
  observedAt: string | null
  expiresAt: string | null
  earliestResetAt: string | null
  lastAttemptAt: string | null
  nextProbeAt: string | null
  lastSuccessAt: string | null
  consecutiveFailures: number
  lastError: QuotaCollectionError | null
  runtime: QuotaRuntime | null
  plan: QuotaPlan | null
  primaryWindows: QuotaWindow[]
  windowCount: number
  windows: QuotaWindow[]
}

export type QuotaSummary = {
  total: number
  healthy: number
  low: number
  exhausted: number
  unknown: number
  error: number
  unsupported: number
  stale: number
  never: number
  collecting: number
  needsAttention: number
}

export type QuotaFacetOption = {
  value: string
  count: number
}

export type QuotaFacets = {
  providers: QuotaFacetOption[]
  quotaStatuses: QuotaFacetOption[]
  freshness: QuotaFacetOption[]
  sources: QuotaFacetOption[]
  credentialStatuses: QuotaFacetOption[]
  collectionStatuses: QuotaFacetOption[]
}

export type QuotaSnapshot = {
  fetchedAt: string
  lastObservedAt: string | null
  total: number
  limit: number
  offset: number
  sort: QuotaSort
  summary: QuotaSummary
  globalSummary: QuotaSummary
  facets: QuotaFacets
  items: QuotaCredential[]
}

export type QuotaListQuery = {
  limit: number
  offset: number
  search?: string
  provider?: string | string[]
  quotaStatus?: QuotaStatus | QuotaStatus[]
  freshness?: QuotaFreshness | QuotaFreshness[]
  source?: QuotaDataSource | QuotaDataSource[]
  credentialStatus?: QuotaCredentialStatus | QuotaCredentialStatus[]
  collectionStatus?: QuotaCollectionStatus | QuotaCollectionStatus[]
  sort?: QuotaSort
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function readNumber(record: UnknownRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

function readBoolean(record: UnknownRecord, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
  }
  return null
}

function normalizeQuotaStatus(value: string | null): QuotaStatus {
  if (
    value === 'healthy' ||
    value === 'low' ||
    value === 'exhausted' ||
    value === 'unknown' ||
    value === 'error' ||
    value === 'unsupported'
  ) {
    return value
  }
  return 'unknown'
}

function normalizeQuotaFreshness(value: string | null): QuotaFreshness {
  if (value === 'fresh' || value === 'stale' || value === 'never') return value
  return 'never'
}

function normalizeQuotaSource(value: string | null): QuotaDataSource {
  if (
    value === 'response_header' ||
    value === 'active_probe' ||
    value === 'mixed' ||
    value === 'none'
  ) {
    return value
  }
  return 'none'
}

function normalizeCollectionStatus(value: string | null): QuotaCollectionStatus {
  if (
    value === 'idle' ||
    value === 'collecting' ||
    value === 'success' ||
    value === 'partial' ||
    value === 'failed' ||
    value === 'unsupported'
  ) {
    return value
  }
  return 'idle'
}

function normalizeQuotaUnit(value: string | null): QuotaUnit {
  if (value === 'usd') return 'currency'
  if (value === 'percent') return 'percentage'
  if (
    value === 'requests' ||
    value === 'tokens' ||
    value === 'credits' ||
    value === 'currency' ||
    value === 'percentage' ||
    value === 'unknown'
  ) {
    return value
  }
  return 'unknown'
}

function normalizeWindowMode(value: string | null): QuotaWindowMode {
  if (value === 'rolling' || value === 'fixed' || value === 'balance' || value === 'unknown') {
    return value
  }
  return 'unknown'
}

function normalizeWindowPeriodUnit(value: string | null): QuotaWindowPeriodUnit {
  if (
    value === 'minute' ||
    value === 'hour' ||
    value === 'day' ||
    value === 'week' ||
    value === 'month'
  ) {
    return value
  }
  return 'unknown'
}

function normalizeQuotaSort(value: string | null): QuotaSort {
  if (
    value === 'risk_desc' ||
    value === 'observed_at_desc' ||
    value === 'observed_at_asc' ||
    value === 'reset_at_asc' ||
    value === 'provider_asc' ||
    value === 'label_asc'
  ) {
    return value
  }
  return 'risk_desc'
}

function normalizeCredentialStatus(record: UnknownRecord): QuotaCredentialStatus {
  const explicitStatus = readString(record, ['credential_status', 'credentialStatus'])
  if (
    explicitStatus === 'enabled' ||
    explicitStatus === 'disabled' ||
    explicitStatus === 'unavailable' ||
    explicitStatus === 'cooldown' ||
    explicitStatus === 'unknown'
  ) {
    return explicitStatus
  }
  if (readBoolean(record, ['unavailable']) === true) return 'unavailable'
  if (readBoolean(record, ['disabled']) === true) return 'disabled'
  return 'enabled'
}

function normalizeCredentialType(value: string | null): QuotaCredentialType {
  if (
    value === 'oauth' ||
    value === 'provider_api_key' ||
    value === 'file_auth' ||
    value === 'vertex' ||
    value === 'unknown'
  ) {
    return value
  }
  return 'unknown'
}

function normalizeWindowScope(value: string | null): QuotaWindowScope {
  if (
    value === 'account' ||
    value === 'project' ||
    value === 'model' ||
    value === 'organization' ||
    value === 'unknown'
  ) {
    return value
  }
  return 'unknown'
}

function normalizeRatio(value: number | null): number | null {
  if (value === null) return null
  return value >= 0 && value <= 1 ? value : null
}

function normalizeQuotaWindow(value: unknown, index: number): QuotaWindow {
  const record = isRecord(value) ? value : {}
  const label = readString(record, ['label', 'name'])
  const windowSeconds = readNumber(record, ['window_seconds', 'windowSeconds'])
  const rawPeriodUnit = normalizeWindowPeriodUnit(readString(record, ['period_unit', 'periodUnit']))
  const rawPeriodValue = readNumber(record, ['period_value', 'periodValue'])
  const hasValidPeriod =
    rawPeriodUnit !== 'unknown' && rawPeriodValue !== null && rawPeriodValue > 0

  return {
    id: readString(record, ['id', 'key']) ?? `window-${index + 1}`,
    label,
    scope: normalizeWindowScope(readString(record, ['scope'])),
    scopeId: readString(record, ['scope_id', 'scopeId', 'model', 'project']),
    mode: normalizeWindowMode(readString(record, ['mode'])),
    status: normalizeQuotaStatus(readString(record, ['status'])),
    unit: normalizeQuotaUnit(readString(record, ['unit'])),
    currency: readString(record, ['currency']),
    used: readNumber(record, ['used']),
    remaining: readNumber(record, ['remaining']),
    limit: readNumber(record, ['limit']),
    usedRatio: normalizeRatio(readNumber(record, ['used_ratio', 'usedRatio', 'used_percentage'])),
    remainingRatio: normalizeRatio(
      readNumber(record, ['remaining_ratio', 'remainingRatio', 'remaining_percentage']),
    ),
    isUnlimited: readBoolean(record, ['is_unlimited', 'isUnlimited']) ?? false,
    resetAt: readString(record, ['reset_at', 'resetAt']),
    windowSeconds,
    periodUnit: hasValidPeriod ? rawPeriodUnit : 'unknown',
    periodValue: hasValidPeriod ? rawPeriodValue : null,
    observedAt: readString(record, ['observed_at', 'observedAt']),
    source: normalizeQuotaSource(readString(record, ['source'])),
  }
}

function normalizeCollectionError(value: unknown): QuotaCollectionError | null {
  if (!isRecord(value)) return null
  const message = readString(value, ['message'])
  if (!message) return null
  return {
    code: readString(value, ['code']),
    message,
    retryable: readBoolean(value, ['retryable']) ?? false,
    occurredAt: readString(value, ['occurred_at', 'occurredAt']),
    upstreamStatusCode: readNumber(value, ['upstream_status_code', 'upstreamStatusCode']),
    requestId: readString(value, ['request_id', 'requestId']),
  }
}

function normalizeQuotaRuntime(value: unknown): QuotaRuntime | null {
  if (!isRecord(value)) return null
  const runtime = {
    homeId: readString(value, ['home_id', 'homeId']),
    homeLabel: readString(value, ['home_label', 'homeLabel']),
    cpaNodeId: readString(value, ['cpa_node_id', 'cpaNodeId']),
    cpaNodeLabel: readString(value, ['cpa_node_label', 'cpaNodeLabel']),
  }
  return Object.values(runtime).some(Boolean) ? runtime : null
}

function normalizeQuotaPlan(value: unknown): QuotaPlan | null {
  if (!isRecord(value)) return null
  const name = readString(value, ['name'])
  if (!name) return null
  return { name, premium: readBoolean(value, ['premium']) ?? false }
}

function normalizeQuotaCredential(value: unknown, index: number): QuotaCredential {
  const record = isRecord(value) ? value : {}
  const rawPrimaryWindows = record.primary_windows ?? record.primaryWindows
  const rawWindows = record.windows
  const authIndex = readString(record, ['auth_index', 'authIndex'])
  const id =
    readString(record, ['credential_id', 'credentialId', 'id']) ?? authIndex ?? `quota-${index}`
  const primaryWindows = Array.isArray(rawPrimaryWindows)
    ? rawPrimaryWindows.map((window, windowIndex) => normalizeQuotaWindow(window, windowIndex))
    : []
  const windows = Array.isArray(rawWindows)
    ? rawWindows.map((window, windowIndex) => normalizeQuotaWindow(window, windowIndex))
    : []

  return {
    id,
    name: readString(record, ['name', 'label']) ?? id,
    authIndex,
    provider: readString(record, ['provider', 'type']) ?? 'unknown',
    credentialType: normalizeCredentialType(
      readString(record, ['credential_type', 'credentialType']),
    ),
    account: readString(record, ['account', 'email']),
    project: readString(record, ['project']),
    credentialStatus: normalizeCredentialStatus(record),
    status: normalizeQuotaStatus(readString(record, ['quota_status', 'quotaStatus', 'status'])),
    freshness: normalizeQuotaFreshness(readString(record, ['freshness'])),
    source: normalizeQuotaSource(readString(record, ['source'])),
    collectionStatus: normalizeCollectionStatus(
      readString(record, ['collection_status', 'collectionStatus']),
    ),
    observedAt: readString(record, ['observed_at', 'observedAt']),
    expiresAt: readString(record, ['expires_at', 'expiresAt']),
    earliestResetAt: readString(record, ['earliest_reset_at', 'earliestResetAt']),
    lastAttemptAt: readString(record, ['last_attempt_at', 'lastAttemptAt']),
    nextProbeAt: readString(record, ['next_probe_at', 'nextProbeAt']),
    lastSuccessAt: readString(record, ['last_success_at', 'lastSuccessAt']),
    consecutiveFailures: readCount(record, ['consecutive_failures', 'consecutiveFailures'], 0),
    lastError: normalizeCollectionError(record.error ?? record.last_error ?? record.lastError),
    runtime: normalizeQuotaRuntime(record.runtime),
    plan: normalizeQuotaPlan(record.plan),
    primaryWindows,
    windowCount: readCount(
      record,
      ['window_count', 'windowCount'],
      Math.max(primaryWindows.length, windows.length),
    ),
    windows,
  }
}

export function createQuotaSummary(items: QuotaCredential[]): QuotaSummary {
  const summary: QuotaSummary = {
    total: items.length,
    healthy: 0,
    low: 0,
    exhausted: 0,
    unknown: 0,
    error: 0,
    unsupported: 0,
    stale: 0,
    never: 0,
    collecting: 0,
    needsAttention: 0,
  }

  for (const item of items) {
    summary[item.status] += 1
    if (item.freshness === 'stale') summary.stale += 1
    if (item.freshness === 'never') summary.never += 1
    if (item.collectionStatus === 'collecting') summary.collecting += 1
    if (
      item.status !== 'healthy' ||
      item.freshness !== 'fresh' ||
      item.collectionStatus === 'partial' ||
      item.collectionStatus === 'failed'
    ) {
      summary.needsAttention += 1
    }
  }

  return summary
}

function createFacetOptions(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return Array.from(counts, ([value, count]) => ({ value, count })).sort((left, right) =>
    left.value.localeCompare(right.value),
  )
}

export function createQuotaFacets(items: QuotaCredential[]): QuotaFacets {
  return {
    providers: createFacetOptions(items.map((item) => item.provider)),
    quotaStatuses: createFacetOptions(items.map((item) => item.status)),
    freshness: createFacetOptions(items.map((item) => item.freshness)),
    sources: createFacetOptions(items.map((item) => item.source)),
    credentialStatuses: createFacetOptions(items.map((item) => item.credentialStatus)),
    collectionStatuses: createFacetOptions(items.map((item) => item.collectionStatus)),
  }
}

function readCount(record: UnknownRecord, keys: string[], fallback: number) {
  const value = readNumber(record, keys)
  return value === null ? fallback : Math.max(0, Math.trunc(value))
}

function normalizeQuotaSummary(value: unknown, items: QuotaCredential[]) {
  const fallback = createQuotaSummary(items)
  if (!isRecord(value)) return fallback

  return {
    total: readCount(value, ['total_credentials', 'total'], fallback.total),
    healthy: readCount(value, ['healthy'], fallback.healthy),
    low: readCount(value, ['low'], fallback.low),
    exhausted: readCount(value, ['exhausted'], fallback.exhausted),
    unknown: readCount(value, ['unknown'], fallback.unknown),
    error: readCount(value, ['error'], fallback.error),
    unsupported: readCount(value, ['unsupported'], fallback.unsupported),
    stale: readCount(value, ['stale'], fallback.stale),
    never: readCount(value, ['never'], fallback.never),
    collecting: readCount(value, ['collecting'], fallback.collecting),
    needsAttention: readCount(
      value,
      ['needs_attention', 'needsAttention', 'attention'],
      fallback.needsAttention,
    ),
  }
}

function normalizeFacetOptions(value: unknown): QuotaFacetOption[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((candidate) => {
    if (!isRecord(candidate)) return []
    const facetValue = readString(candidate, ['value'])
    if (!facetValue) return []
    return [{ value: facetValue, count: readCount(candidate, ['count'], 0) }]
  })
}

function normalizeQuotaFacets(value: unknown, items: QuotaCredential[]): QuotaFacets {
  const fallback = createQuotaFacets(items)
  if (!isRecord(value)) return fallback

  return {
    providers: normalizeFacetOptions(value.providers).length
      ? normalizeFacetOptions(value.providers)
      : fallback.providers,
    quotaStatuses: normalizeFacetOptions(value.quota_statuses ?? value.quotaStatuses),
    freshness: normalizeFacetOptions(value.freshness),
    sources: normalizeFacetOptions(value.sources),
    credentialStatuses: normalizeFacetOptions(
      value.credential_statuses ?? value.credentialStatuses,
    ),
    collectionStatuses: normalizeFacetOptions(
      value.collection_statuses ?? value.collectionStatuses,
    ),
  }
}

export function normalizeQuotaSnapshot(responseData: unknown): QuotaSnapshot {
  const root = isRecord(responseData) ? responseData : {}
  const rawSummary = isRecord(root.summary) ? root.summary : {}
  const items = Array.isArray(root.items)
    ? root.items.map((item, index) => normalizeQuotaCredential(item, index))
    : []

  const summary = normalizeQuotaSummary(rawSummary, items)
  const globalSummary = normalizeQuotaSummary(root.global_summary ?? root.globalSummary, items)

  return {
    fetchedAt:
      readString(root, ['fetched_at', 'fetchedAt', 'generated_at', 'generatedAt']) ??
      new Date().toISOString(),
    lastObservedAt:
      readString(root, ['last_observed_at', 'lastObservedAt']) ??
      readString(rawSummary, ['last_observed_at', 'lastObservedAt']),
    total: readCount(root, ['total'], summary.total),
    limit: readCount(root, ['limit'], Math.max(items.length, 1)),
    offset: readCount(root, ['offset'], 0),
    sort: normalizeQuotaSort(readString(root, ['sort'])),
    summary,
    globalSummary: isRecord(root.global_summary ?? root.globalSummary) ? globalSummary : summary,
    facets: normalizeQuotaFacets(root.facets, items),
    items,
  }
}

export async function fetchQuotaSnapshot(
  session: ManagementSessionInput,
  query: QuotaListQuery,
): Promise<QuotaSnapshot> {
  const client = createManagementClient(session)
  const csv = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value.join(',') : value
  const response = await client.get<unknown>('/quota/credentials', {
    params: {
      limit: query.limit,
      offset: query.offset,
      search: query.search,
      provider: csv(query.provider),
      quota_status: csv(query.quotaStatus),
      freshness: csv(query.freshness),
      source: csv(query.source),
      credential_status: csv(query.credentialStatus),
      collection_status: csv(query.collectionStatus),
      sort: query.sort ?? 'risk_desc',
    },
  })
  return normalizeQuotaSnapshot(response.data)
}

export function normalizeQuotaCredentialDetail(responseData: unknown): QuotaCredential {
  const root = isRecord(responseData) ? responseData : {}
  const rawCredential = isRecord(root.credential)
    ? root.credential
    : isRecord(root.item)
      ? root.item
      : root
  const collection = isRecord(root.collection) ? root.collection : {}

  return normalizeQuotaCredential(
    {
      ...rawCredential,
      windows: root.windows ?? rawCredential.windows,
      source: collection.source ?? rawCredential.source,
      freshness: collection.freshness ?? rawCredential.freshness,
      collection_status:
        collection.status ?? collection.collection_status ?? rawCredential.collection_status,
      observed_at: collection.observed_at ?? rawCredential.observed_at,
      expires_at: collection.expires_at ?? rawCredential.expires_at,
      last_attempt_at: collection.last_attempt_at ?? rawCredential.last_attempt_at,
      next_probe_at: collection.next_probe_at ?? rawCredential.next_probe_at,
      last_success_at: collection.last_success_at ?? rawCredential.last_success_at,
      consecutive_failures: collection.consecutive_failures ?? rawCredential.consecutive_failures,
      error: collection.error ?? rawCredential.error,
    },
    0,
  )
}

export async function fetchQuotaCredentialDetail(
  session: ManagementSessionInput,
  credentialId: string,
): Promise<QuotaCredential> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>(
    `/quota/credentials/${encodeURIComponent(credentialId)}`,
  )
  return normalizeQuotaCredentialDetail(response.data)
}

export type QuotaCollectInput = {
  credentialIds?: string[]
  providers?: string[]
}

export type QuotaCollectResult = {
  accepted: number
  running: boolean
}

export async function triggerQuotaCollection(
  session: ManagementSessionInput,
  input: QuotaCollectInput = {},
): Promise<QuotaCollectResult> {
  const client = createManagementClient(session)
  const response = await client.post<unknown>('/quota/collect', {
    credential_ids: input.credentialIds?.length ? input.credentialIds : undefined,
    providers: input.providers?.length ? input.providers : undefined,
  })
  const root = isRecord(response.data) ? response.data : {}
  return {
    accepted: readCount(root, ['accepted'], 0),
    running: readBoolean(root, ['running']) ?? false,
  }
}

export function toQuotaApiError(error: unknown): Error & ManagementApiError {
  const apiError = toManagementApiError(error)
  return Object.assign(new Error(apiError.message), apiError)
}
