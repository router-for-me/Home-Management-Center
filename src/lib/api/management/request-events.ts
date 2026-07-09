import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementApiError, ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type RequestEventStatusFilter = 'all' | 'success' | 'failed'
export type RequestEventSortKey =
  | 'timestamp_desc'
  | 'timestamp_asc'
  | 'latency_desc'
  | 'latency_asc'
  | 'tokens_desc'
  | 'tokens_asc'
  | 'cost_desc'
  | 'cost_asc'
  | 'failed_first'
export type RequestEventTimeRangePreset =
  | '4h'
  | '12h'
  | '24h'
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | '90d'
  | 'custom'

export type RequestEventFilters = {
  range: RequestEventTimeRangePreset
  customFrom: string
  customTo: string
  search: string
  requestId: string
  eventType: string
  status: RequestEventStatusFilter
  statusCode: string
  provider: string
  model: string
  homeIp: string
  cpaNode: string
  credentialId: string
  authIndex: string
  user: string
  clientKey: string
  minLatencyMs: string
  maxLatencyMs: string
  sort: RequestEventSortKey
  limit: number
  offset: number
}

export type RequestEventTokens = {
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cachedTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  totalTokens: number
}

export type RequestEventPerformance = {
  latencyMs: number | null
  ttftMs: number | null
  tps: number | null
}

export type RequestEventRuntime = {
  homeIp: string | null
  homePort: number | null
  homeId: string | null
  cpaNodeId: string | null
  cpaIp: string | null
  cpaPort: number | null
  cpaLabel: string | null
}

export type RequestEventCredential = {
  credentialType: string | null
  credentialId: string | null
  authIndex: string | null
  provider: string | null
  label: string | null
  source: string | null
  apiKeyPreview: string | null
}

export type RequestEventClient = {
  userId: number | null
  username: string | null
  clientKeyId: number | null
  clientKeyLabel: string | null
  clientKeyMasked: string | null
  clientIp: string | null
}

export type RequestEventError = {
  statusCode: number | null
  upstreamStatusCode: number | null
  reason: string | null
  message: string | null
  bodyPreview: string | null
}

export type RequestEventBilling = {
  amount: number | null
  currency: string | null
  chargeId: string | null
  matchedPriceRule: string | null
}

export type RequestEventRelated = {
  usageRecordId: string | null
  requestLog: {
    requestId: string | null
    homeIp: string | null
    homePort: number | null
    available: boolean | null
    downloadUrl: string | null
  } | null
}

export type RequestEvent = {
  id: string
  timestamp: string
  requestId: string | null
  upstreamRequestId: string | null
  eventType: string | null
  status: 'success' | 'failed' | 'unknown'
  failed: boolean
  statusCode: number | null
  upstreamStatusCode: number | null
  provider: string | null
  model: string | null
  originalModel: string | null
  modelAlias: string | null
  endpoint: string | null
  source: string | null
  executorType: string | null
  serviceTier: string | null
  reasoningEffort: string | null
  runtime: RequestEventRuntime
  credential: RequestEventCredential | null
  client: RequestEventClient | null
  error: RequestEventError | null
  tokens: RequestEventTokens
  performance: RequestEventPerformance
  billing: RequestEventBilling | null
  related: RequestEventRelated | null
  raw: UnknownRecord
}

export type RequestEventPayloadSummary = {
  method: string | null
  stream: boolean | null
  messageCount: number | null
  toolCount: number | null
  bodyPreview: string | null
}

export type RequestEventDetail = {
  event: RequestEvent
  payloadSummary: RequestEventPayloadSummary | null
  logExcerpt: string[]
  raw: UnknownRecord
}

export type RequestEventsPage = {
  items: RequestEvent[]
  total: number
  limit: number
  offset: number
  sort: RequestEventSortKey
}

export type RequestEventFilterOptions = {
  eventTypes: string[]
  providers: string[]
  models: string[]
  homeIps: string[]
  cpaNodes: string[]
  statusCodes: string[]
}

export type RequestEventDownloadResult = {
  blob: Blob
  fileName: string
}

export type RequestEventsApiError = Error & Pick<ManagementApiError, 'status' | 'code'>

export const defaultRequestEventFilters: RequestEventFilters = {
  range: '24h',
  customFrom: '',
  customTo: '',
  search: '',
  requestId: '',
  eventType: 'all',
  status: 'all',
  statusCode: 'all',
  provider: 'all',
  model: 'all',
  homeIp: 'all',
  cpaNode: 'all',
  credentialId: '',
  authIndex: '',
  user: '',
  clientKey: '',
  minLatencyMs: '',
  maxLatencyMs: '',
  sort: 'timestamp_desc',
  limit: 50,
  offset: 0,
}

function isNonNegativeIntegerInput(value: string) {
  const trimmed = value.trim()
  return trimmed === '' || /^\d+$/.test(trimmed)
}

export function isRequestEventLatencyRangeValid(
  filters: Pick<RequestEventFilters, 'minLatencyMs' | 'maxLatencyMs'>,
) {
  const minLatencyMs = filters.minLatencyMs.trim()
  const maxLatencyMs = filters.maxLatencyMs.trim()

  if (!isNonNegativeIntegerInput(minLatencyMs) || !isNonNegativeIntegerInput(maxLatencyMs)) {
    return false
  }

  if (!minLatencyMs || !maxLatencyMs) return true
  return Number(minLatencyMs) <= Number(maxLatencyMs)
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

function readStringFromKeys(record: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = readString(record, key)
    if (value !== null) return value
  }
  return null
}

function readNumber(record: UnknownRecord, key: string): number | null {
  const value = record[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function readNumberFromKeys(record: UnknownRecord, keys: string[]): number | null {
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

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function normalizeStringOptions(value: unknown): string[] {
  return readArray(value)
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (typeof item === 'number' && Number.isFinite(item)) return String(item)
      return null
    })
    .filter((item): item is string => Boolean(item))
}

function readStringOptionsFromKeys(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    if (key in record) return normalizeStringOptions(record[key])
  }
  return []
}

function getTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function parseDateOnly(value: string, mode: 'start' | 'end') {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(`${trimmed}T00:00:00`)
    if (Number.isNaN(date.getTime())) return null
    if (mode === 'end') date.setHours(23, 59, 59, 999)
    return date
  }

  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfLocalDay(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function getDateRange(filters: RequestEventFilters) {
  const now = new Date()

  if (filters.range === 'custom') {
    const from = parseDateOnly(filters.customFrom, 'start')
    const to = parseDateOnly(filters.customTo, 'end')
    return {
      from: from?.toISOString(),
      to: to?.toISOString(),
    }
  }

  if (filters.range === '4h' || filters.range === '12h' || filters.range === '24h') {
    const hours = filters.range === '4h' ? 4 : filters.range === '12h' ? 12 : 24
    return {
      from: new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
    }
  }

  if (filters.range === 'today') {
    return {
      from: startOfLocalDay(now).toISOString(),
      to: now.toISOString(),
    }
  }

  if (filters.range === 'yesterday') {
    const todayStart = startOfLocalDay(now)
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(todayStart.getDate() - 1)
    return {
      from: yesterdayStart.toISOString(),
      to: todayStart.toISOString(),
    }
  }

  const days = filters.range === '90d' ? 90 : filters.range === '30d' ? 30 : 7
  const from = new Date(now)
  from.setDate(now.getDate() - days + 1)
  from.setHours(0, 0, 0, 0)
  return {
    from: from.toISOString(),
    to: now.toISOString(),
  }
}

function getRequestEventQueryParams(filters: RequestEventFilters, pagination = true) {
  const range = getDateRange(filters)
  const credentialId = filters.credentialId.trim()
  const authIndex = filters.authIndex.trim()
  const user = filters.user.trim()
  const clientKey = filters.clientKey.trim()
  const requestId = filters.requestId.trim()
  const search = filters.search.trim()
  const minLatencyMs = filters.minLatencyMs.trim()
  const maxLatencyMs = filters.maxLatencyMs.trim()

  return {
    from: range.from,
    to: range.to,
    timezone: getTimeZone(),
    ...(pagination ? { limit: filters.limit, offset: filters.offset } : {}),
    sort: filters.sort,
    ...(search ? { search } : {}),
    ...(requestId ? { request_id: requestId } : {}),
    ...(filters.eventType !== 'all' ? { event_type: filters.eventType } : {}),
    ...(filters.status !== 'all' ? { status: filters.status } : {}),
    ...(filters.statusCode !== 'all' ? { status_code: filters.statusCode } : {}),
    ...(filters.provider !== 'all' ? { provider: filters.provider } : {}),
    ...(filters.model !== 'all' ? { model: filters.model } : {}),
    ...(filters.homeIp !== 'all' ? { home_ip: filters.homeIp } : {}),
    ...(filters.cpaNode !== 'all' ? { cpa_node: filters.cpaNode } : {}),
    ...(credentialId ? { credential_id: credentialId } : {}),
    ...(authIndex ? { auth_index: authIndex } : {}),
    ...(user ? { user } : {}),
    ...(clientKey ? { client_key: clientKey } : {}),
    ...(minLatencyMs ? { min_latency_ms: minLatencyMs } : {}),
    ...(maxLatencyMs ? { max_latency_ms: maxLatencyMs } : {}),
  }
}

function normalizeTokens(value: unknown): RequestEventTokens {
  const record = toRecord(value)
  return {
    inputTokens: readNumberFromKeys(record, ['input_tokens', 'inputTokens']) ?? 0,
    outputTokens: readNumberFromKeys(record, ['output_tokens', 'outputTokens']) ?? 0,
    reasoningTokens: readNumberFromKeys(record, ['reasoning_tokens', 'reasoningTokens']) ?? 0,
    cachedTokens: readNumberFromKeys(record, ['cached_tokens', 'cachedTokens']) ?? 0,
    cacheReadTokens: readNumberFromKeys(record, ['cache_read_tokens', 'cacheReadTokens']) ?? 0,
    cacheCreationTokens:
      readNumberFromKeys(record, ['cache_creation_tokens', 'cacheCreationTokens']) ?? 0,
    totalTokens: readNumberFromKeys(record, ['total_tokens', 'totalTokens']) ?? 0,
  }
}

function normalizePerformance(value: unknown, root: UnknownRecord): RequestEventPerformance {
  const record = toRecord(value)
  return {
    latencyMs:
      readNumberFromKeys(record, ['latency_ms', 'latencyMs']) ??
      readNumberFromKeys(root, ['latency_ms', 'latencyMs']),
    ttftMs:
      readNumberFromKeys(record, ['ttft_ms', 'ttftMs']) ??
      readNumberFromKeys(root, ['ttft_ms', 'ttftMs']),
    tps: readNumberFromKeys(record, ['tps', 'speed_tps', 'speedTps']),
  }
}

function normalizeRuntime(value: unknown, root: UnknownRecord): RequestEventRuntime {
  const record = toRecord(value)
  const cpaNode = toRecord(root.cpa_node ?? root.cpaNode)
  return {
    homeIp:
      readStringFromKeys(record, ['home_ip', 'homeIp']) ??
      readStringFromKeys(root, ['home_ip', 'homeIp']),
    homePort:
      readNumberFromKeys(record, ['home_port', 'homePort']) ??
      readNumberFromKeys(root, ['home_port', 'homePort']),
    homeId:
      readStringFromKeys(record, ['home_id', 'homeId']) ??
      readStringFromKeys(root, ['home_id', 'homeId']),
    cpaNodeId:
      readStringFromKeys(record, ['cpa_node_id', 'cpaNodeId']) ??
      readStringFromKeys(cpaNode, ['id', 'node_id', 'nodeId']) ??
      readStringFromKeys(root, ['cpa_node_id', 'cpaNodeId']),
    cpaIp:
      readStringFromKeys(record, ['cpa_ip', 'cpaIp']) ??
      readStringFromKeys(cpaNode, ['ip', 'cpa_ip', 'cpaIp']) ??
      readStringFromKeys(root, ['cpa_ip', 'cpaIp']),
    cpaPort:
      readNumberFromKeys(record, ['cpa_port', 'cpaPort']) ??
      readNumberFromKeys(cpaNode, ['port', 'cpa_port', 'cpaPort']) ??
      readNumberFromKeys(root, ['cpa_port', 'cpaPort']),
    cpaLabel:
      readStringFromKeys(record, ['cpa_label', 'cpaLabel']) ??
      readStringFromKeys(cpaNode, ['label', 'name']) ??
      readStringFromKeys(root, ['cpa_label', 'cpaLabel']),
  }
}

function normalizeCredential(value: unknown, root: UnknownRecord): RequestEventCredential | null {
  const record = isRecord(value) ? value : toRecord(root.credential)
  if (!isRecord(value) && Object.keys(record).length === 0) return null
  return {
    credentialType: readStringFromKeys(record, ['credential_type', 'credentialType', 'type']),
    credentialId: readStringFromKeys(record, ['credential_id', 'credentialId', 'id']),
    authIndex:
      readStringFromKeys(record, ['auth_index', 'authIndex']) ??
      readStringFromKeys(root, ['auth_index', 'authIndex']),
    provider: readString(record, 'provider'),
    label: readString(record, 'label'),
    source: readString(record, 'source'),
    apiKeyPreview: readStringFromKeys(record, ['api_key_preview', 'apiKeyPreview']),
  }
}

function normalizeClient(value: unknown): RequestEventClient | null {
  if (!isRecord(value)) return null
  return {
    userId: readNumberFromKeys(value, ['user_id', 'userId']),
    username: readString(value, 'username'),
    clientKeyId: readNumberFromKeys(value, [
      'client_key_id',
      'clientKeyId',
      'api_key_id',
      'apiKeyId',
    ]),
    clientKeyLabel: readStringFromKeys(value, [
      'client_key_label',
      'clientKeyLabel',
      'api_key_label',
      'apiKeyLabel',
    ]),
    clientKeyMasked: readStringFromKeys(value, [
      'client_key_masked',
      'clientKeyMasked',
      'api_key_masked',
      'apiKeyMasked',
    ]),
    clientIp: readStringFromKeys(value, ['client_ip', 'clientIp']),
  }
}

function normalizeError(value: unknown): RequestEventError | null {
  if (!isRecord(value)) return null
  const error = {
    statusCode: readNumberFromKeys(value, ['status_code', 'statusCode']),
    upstreamStatusCode: readNumberFromKeys(value, ['upstream_status_code', 'upstreamStatusCode']),
    reason: readString(value, 'reason'),
    message: readString(value, 'message'),
    bodyPreview: readStringFromKeys(value, ['body_preview', 'bodyPreview']),
  }

  if (
    error.statusCode === null &&
    error.upstreamStatusCode === null &&
    error.reason === null &&
    error.message === null &&
    error.bodyPreview === null
  ) {
    return null
  }

  return error
}

function normalizeBilling(value: unknown): RequestEventBilling | null {
  if (!isRecord(value)) return null
  return {
    amount: readNumber(value, 'amount'),
    currency: readString(value, 'currency'),
    chargeId: readStringFromKeys(value, ['charge_id', 'chargeId']),
    matchedPriceRule: readStringFromKeys(value, ['matched_price_rule', 'matchedPriceRule']),
  }
}

function normalizeRelated(value: unknown): RequestEventRelated | null {
  if (!isRecord(value)) return null
  const requestLogValue = value.request_log ?? value.requestLog
  const requestLog = isRecord(requestLogValue)
    ? {
        requestId: readStringFromKeys(requestLogValue, ['request_id', 'requestId']),
        homeIp: readStringFromKeys(requestLogValue, ['home_ip', 'homeIp']),
        homePort: readNumberFromKeys(requestLogValue, ['home_port', 'homePort']),
        available: readBoolean(requestLogValue, 'available'),
        downloadUrl: readStringFromKeys(requestLogValue, ['download_url', 'downloadUrl']),
      }
    : null

  return {
    usageRecordId: readStringFromKeys(value, [
      'usage_record_id',
      'usageRecordId',
      'usage_id',
      'usageId',
    ]),
    requestLog,
  }
}

function normalizeRequestEvent(value: unknown, index: number): RequestEvent {
  const record = toRecord(value)
  const statusText = readString(record, 'status')?.toLowerCase()
  const explicitFailed = readBoolean(record, 'failed')
  const status =
    statusText === 'success' || explicitFailed === false
      ? 'success'
      : statusText === 'failed' || explicitFailed === true
        ? 'failed'
        : 'unknown'
  const failed = status === 'failed'
  const error = normalizeError(record.error)
  const statusCode =
    readNumberFromKeys(record, ['status_code', 'statusCode']) ??
    error?.statusCode ??
    (status === 'success' ? 200 : null)

  return {
    id:
      readString(record, 'id') ??
      readStringFromKeys(record, ['event_id', 'eventId']) ??
      `request-event-${index + 1}`,
    timestamp: readString(record, 'timestamp') ?? new Date().toISOString(),
    requestId: readStringFromKeys(record, ['request_id', 'requestId']),
    upstreamRequestId: readStringFromKeys(record, ['upstream_request_id', 'upstreamRequestId']),
    eventType: readStringFromKeys(record, ['event_type', 'eventType', 'type']),
    status,
    failed,
    statusCode,
    upstreamStatusCode:
      readNumberFromKeys(record, ['upstream_status_code', 'upstreamStatusCode']) ??
      error?.upstreamStatusCode ??
      null,
    provider: readString(record, 'provider'),
    model: readString(record, 'model'),
    originalModel: readStringFromKeys(record, ['original_model', 'originalModel']),
    modelAlias: readStringFromKeys(record, ['model_alias', 'modelAlias', 'alias']),
    endpoint: readString(record, 'endpoint'),
    source: readString(record, 'source'),
    executorType: readStringFromKeys(record, ['executor_type', 'executorType']),
    serviceTier: readStringFromKeys(record, ['service_tier', 'serviceTier']),
    reasoningEffort: readStringFromKeys(record, ['reasoning_effort', 'reasoningEffort']),
    runtime: normalizeRuntime(record.runtime, record),
    credential: normalizeCredential(record.credential, record),
    client: normalizeClient(record.client),
    error,
    tokens: normalizeTokens(record.tokens),
    performance: normalizePerformance(record.performance, record),
    billing: normalizeBilling(record.billing),
    related: normalizeRelated(record.related),
    raw: record,
  }
}

function normalizeSort(value: string | null): RequestEventSortKey {
  const allowed: RequestEventSortKey[] = [
    'timestamp_desc',
    'timestamp_asc',
    'latency_desc',
    'latency_asc',
    'tokens_desc',
    'tokens_asc',
    'cost_desc',
    'cost_asc',
    'failed_first',
  ]
  return allowed.includes(value as RequestEventSortKey)
    ? (value as RequestEventSortKey)
    : 'timestamp_desc'
}

function normalizeRequestEventsPage(responseData: unknown): RequestEventsPage {
  const root = toRecord(responseData)
  const items = readArray(root.items ?? root.events ?? root.records).map(normalizeRequestEvent)
  return {
    items,
    total:
      readNumberFromKeys(root, ['total', 'total_count', 'totalCount']) ??
      readNumberFromKeys(root, ['count']) ??
      items.length,
    limit: readNumberFromKeys(root, ['limit', 'page_size', 'pageSize']) ?? items.length,
    offset: readNumber(root, 'offset') ?? 0,
    sort: normalizeSort(readString(root, 'sort')),
  }
}

function normalizePayloadSummary(value: unknown): RequestEventPayloadSummary | null {
  if (!isRecord(value)) return null
  return {
    method: readString(value, 'method'),
    stream: readBoolean(value, 'stream'),
    messageCount: readNumberFromKeys(value, ['message_count', 'messageCount']),
    toolCount: readNumberFromKeys(value, ['tool_count', 'toolCount']),
    bodyPreview: readStringFromKeys(value, ['body_preview', 'bodyPreview']),
  }
}

function normalizeRequestEventDetail(responseData: unknown): RequestEventDetail {
  const root = toRecord(responseData)
  const event = normalizeRequestEvent(root.event ?? root.record ?? root, 0)
  return {
    event,
    payloadSummary: normalizePayloadSummary(root.payload_summary ?? root.payloadSummary),
    logExcerpt: readArray(root.log_excerpt ?? root.logExcerpt).filter(
      (line): line is string => typeof line === 'string',
    ),
    raw: root,
  }
}

function deriveFilterOptions(page: RequestEventsPage): RequestEventFilterOptions {
  const eventTypes = new Set<string>()
  const providers = new Set<string>()
  const models = new Set<string>()
  const homeIps = new Set<string>()
  const cpaNodes = new Set<string>()
  const statusCodes = new Set<string>()

  page.items.forEach((event) => {
    if (event.eventType) eventTypes.add(event.eventType)
    if (event.provider) providers.add(event.provider)
    if (event.model) models.add(event.model)
    if (event.runtime.homeIp) homeIps.add(event.runtime.homeIp)
    const cpaNode = event.runtime.cpaLabel ?? event.runtime.cpaNodeId ?? event.runtime.cpaIp
    if (cpaNode) cpaNodes.add(cpaNode)
    if (event.statusCode !== null) statusCodes.add(String(event.statusCode))
    if (event.upstreamStatusCode !== null) statusCodes.add(String(event.upstreamStatusCode))
  })

  return {
    eventTypes: [...eventTypes].sort(),
    providers: [...providers].sort(),
    models: [...models].sort(),
    homeIps: [...homeIps].sort(),
    cpaNodes: [...cpaNodes].sort(),
    statusCodes: [...statusCodes].sort((left, right) => Number(left) - Number(right)),
  }
}

function normalizeRequestEventFilterOptions(responseData: unknown): RequestEventFilterOptions {
  const root = toRecord(responseData)
  const statusCodes = readStringOptionsFromKeys(root, ['status_codes', 'statusCodes'])

  return {
    eventTypes: readStringOptionsFromKeys(root, ['event_types', 'eventTypes']).sort(),
    providers: readStringOptionsFromKeys(root, ['providers']).sort(),
    models: readStringOptionsFromKeys(root, ['models']).sort(),
    homeIps: readStringOptionsFromKeys(root, ['home_ips', 'homeIps']).sort(),
    cpaNodes: readStringOptionsFromKeys(root, ['cpa_nodes', 'cpaNodes']).sort(),
    statusCodes: statusCodes.sort((left, right) => Number(left) - Number(right)),
  }
}

function readContentDispositionFileName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(value)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }
  const quotedMatch = /filename="([^"]+)"/i.exec(value)
  if (quotedMatch?.[1]) return quotedMatch[1]
  const plainMatch = /filename=([^;]+)/i.exec(value)
  return plainMatch?.[1]?.trim() ?? null
}

function getAttachmentFileName(headers: unknown, fallback: string) {
  const headerRecord = toRecord(headers)
  return (
    readContentDispositionFileName(headerRecord['content-disposition']) ??
    readContentDispositionFileName(headerRecord['Content-Disposition']) ??
    fallback
  )
}

export function toRequestEventsApiError(error: unknown): RequestEventsApiError {
  const apiError = toManagementApiError(error)
  const requestEventsError = new Error(apiError.message, { cause: error }) as RequestEventsApiError
  requestEventsError.status = apiError.status
  requestEventsError.code = apiError.code
  return requestEventsError
}

export async function fetchRequestEvents(
  session: ManagementSessionInput,
  filters: RequestEventFilters,
): Promise<RequestEventsPage> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/request-events', {
    params: getRequestEventQueryParams(filters),
  })
  return normalizeRequestEventsPage(response.data)
}

export async function fetchRequestEventFilterOptions(
  session: ManagementSessionInput,
  filters: RequestEventFilters,
  options?: { serverSide?: boolean },
): Promise<RequestEventFilterOptions> {
  if (options?.serverSide) {
    const client = createManagementClient(session)

    try {
      const response = await client.get<unknown>('/request-events/filter-options', {
        params: getRequestEventQueryParams(filters, false),
      })
      return normalizeRequestEventFilterOptions(response.data)
    } catch (error) {
      const apiError = toManagementApiError(error)
      if (apiError.status !== 404 && apiError.status !== 405) throw error
    }
  }

  const page = await fetchRequestEvents(session, { ...filters, limit: 200, offset: 0 })
  return deriveFilterOptions(page)
}

export async function fetchRequestEventDetail(
  session: ManagementSessionInput,
  eventId: string,
): Promise<RequestEventDetail> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>(`/request-events/${encodeURIComponent(eventId)}`, {
    params: {
      include_payload: true,
      include_logs: true,
      include_related: true,
    },
  })
  return normalizeRequestEventDetail(response.data)
}

export async function exportRequestEvents(
  session: ManagementSessionInput,
  filters: RequestEventFilters,
  format: 'csv' | 'jsonl',
): Promise<RequestEventDownloadResult> {
  const client = createManagementClient(session)
  const response = await client.get<Blob>('/request-events/export', {
    params: {
      ...getRequestEventQueryParams(filters, false),
      format,
    },
    responseType: 'blob',
  })

  return {
    blob: response.data,
    fileName: getAttachmentFileName(response.headers, `request-events.${format}`),
  }
}
