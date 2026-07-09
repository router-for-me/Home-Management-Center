import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type {
  CapabilityMap,
  ManagementApiError,
  ManagementSessionInput,
} from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>
export type UsageLogIssueScope =
  | 'apiKeyUsage'
  | 'usageOverview'
  | 'usageRecords'
  | 'usageAggregates'
  | 'usageRecordDetails'
  | 'usageExport'
  | 'usageProviderHealth'
  | 'usageCredentialHealth'
  | 'usageRealtime'
  | 'requestEvents'
  | 'requestLogIndex'
  | 'logs'
  | 'requestErrorLogs'
  | 'clearLogs'

export type UsageLogIssue = {
  scope: UsageLogIssueScope
  message: string
  status?: number
  code?: string
}

export type UsageLogsApiError = Error & Pick<ManagementApiError, 'status' | 'code'>

export type UsageTimeRangePreset =
  | '4h'
  | '12h'
  | '24h'
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | '90d'
  | 'custom'
export type UsageStatusFilter = 'all' | 'success' | 'failed'
export type UsageCredentialType = 'provider_api_key' | 'oauth' | 'file_auth' | 'vertex' | 'unknown'
export type UsageCredentialTypeFilter = 'all' | UsageCredentialType
export type UsageMetricKey = 'requests' | 'tokens' | 'cost' | 'errors' | 'latency'
export type UsageSortKey =
  | 'timestamp_desc'
  | 'timestamp_asc'
  | 'failed_first'
  | 'tokens_desc'
  | 'tokens_asc'
  | 'cost_desc'
  | 'cost_asc'
  | 'latency_desc'
  | 'latency_asc'
export type UsageRecordSortableField = 'timestamp' | 'total_tokens' | 'total_amount' | 'latency_ms'
export type UsageCostCategory = 'input' | 'output' | 'cache' | 'reasoning' | 'request' | 'other'
export type UsageActivityStatus = 'empty' | 'healthy' | 'warning' | 'degraded' | 'failed'
export type UsageHealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'disabled' | 'unknown'
export type UsageQuotaStatus = 'ok' | 'warning' | 'exceeded' | 'unknown'
export type UsageAggregateGroupBy =
  | 'user'
  | 'client_key'
  | 'credential'
  | 'provider'
  | 'model'
  | 'endpoint'
  | 'home_ip'
  | 'executor_type'
  | 'status_code'
export type UsageAggregateMetric =
  | 'request_count'
  | 'total_tokens'
  | 'total_amount'
  | 'failed_count'
  | 'avg_latency_ms'
  | 'p95_latency_ms'
export type UsageAggregateSortDirection = 'asc' | 'desc'
export type UsageAggregateSortState = {
  metric: UsageAggregateMetric
  direction: UsageAggregateSortDirection
} | null

export type UsageAggregatesQuery = {
  groupBy: UsageAggregateGroupBy
  metric: UsageAggregateMetric
  sortDirection: UsageAggregateSortDirection
  limit: number
  offset: number
}

export const defaultUsageAggregatesQuery: UsageAggregatesQuery = {
  groupBy: 'credential',
  metric: 'request_count',
  sortDirection: 'desc',
  limit: 20,
  offset: 0,
}

export const defaultUsageRecordSortableFields: UsageRecordSortableField[] = [
  'timestamp',
  'total_tokens',
  'total_amount',
  'latency_ms',
]

export const defaultUsageAggregateSortableMetrics: UsageAggregateMetric[] = [
  'request_count',
  'total_tokens',
  'total_amount',
  'failed_count',
  'avg_latency_ms',
  'p95_latency_ms',
]

export type UsageFilters = {
  range: UsageTimeRangePreset
  status: UsageStatusFilter
  provider: string
  model: string
  credentialType: UsageCredentialTypeFilter
  homeIp: string
  endpoint: string
  executorType: string
  statusCode: string
  requestId: string
  user: string
  clientKey: string
  credentialId: string
  authIndex: string
  minLatencyMs: string
  maxLatencyMs: string
  minAmount: string
  maxAmount: string
  customFrom: string
  customTo: string
  sort: UsageSortKey | null
  search: string
  limit: number
  offset: number
}

export const defaultUsageFilters: UsageFilters = {
  range: '7d',
  status: 'all',
  provider: 'all',
  model: 'all',
  credentialType: 'all',
  homeIp: 'all',
  endpoint: 'all',
  executorType: 'all',
  statusCode: 'all',
  requestId: '',
  user: '',
  clientKey: '',
  credentialId: '',
  authIndex: '',
  minLatencyMs: '',
  maxLatencyMs: '',
  minAmount: '',
  maxAmount: '',
  customFrom: '',
  customTo: '',
  sort: null,
  search: '',
  limit: 50,
  offset: 0,
}

export type ApiKeyUsageResource = {
  id: string
  provider: string
  baseUrl: string
  apiKeyPreview: string
  success: number
  failed: number
  recentRequestCount: number
}

export type RuntimeLogRecord = {
  id: string
  timestamp: string | null
  clientIp: string | null
  requestId: string | null
  homeIp: string | null
  homePort: number | null
  requestLogAvailable: boolean
  level: string | null
  line: string
  createdAt: string | null
  raw: unknown
}

export type RuntimeLogSnapshot = {
  lines: string[]
  records: RuntimeLogRecord[]
  lineCount: number
  latestTimestamp: number | null
  total: number | null
  limit: number | null
  offset: number | null
}

export type RuntimeLogLevelFilter = 'all' | 'trace' | 'debug' | 'info' | 'warn' | 'error'

export type RuntimeLogFilters = {
  homeIp: string
  clientIp: string
  requestId: string
  level: RuntimeLogLevelFilter
  after: string
  before: string
}

export type RuntimeLogQuery = {
  limit: number
  offset: number
} & RuntimeLogFilters

export const defaultRuntimeLogFilters: RuntimeLogFilters = {
  homeIp: '',
  clientIp: '',
  requestId: '',
  level: 'all',
  after: '',
  before: '',
}

export type RequestErrorLogFile = {
  name: string
  size: number | null
  modified: number | null
}

export type RequestLogIndexItem = {
  id: string
  requestId: string
  timestamp: string | null
  homeIp: string | null
  homePort: number | null
  fileName: string | null
  sizeBytes: number | null
  available: boolean
  provider: string | null
  model: string | null
  status: 'success' | 'failed' | 'unknown'
  downloadUrl: string | null
}

export type RequestLogIndex = {
  items: RequestLogIndexItem[]
  total: number
  limit: number
  offset: number
}

export type UsageRuntimeSettings = {
  usageStatisticsEnabled: boolean
  fileLoggingEnabled: boolean
}

export type UsageTokens = {
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cachedTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  totalTokens: number
}

export type UsagePerformance = {
  latencyMs: number
  ttftMs: number | null
  tps: number | null
}

export type UsageClientIdentity = {
  apiKeyId: number | null
  apiKeyLabel: string | null
  apiKeyMasked: string | null
  userId: number | null
  username: string | null
  clientIp: string | null
}

export type UsageExecutionCredential = {
  credentialType: UsageCredentialType
  credentialId: string | null
  authIndex: string | null
  provider: string | null
  label: string | null
  source: string | null
  status: string | null
  apiKeyPreview: string | null
}

export type UsageBilling = {
  chargeId: string | null
  amount: number | null
  currency: string | null
  matchedPriceRule: string | null
  balanceBefore: number | null
  balanceAfter: number | null
}

export type UsageRuntime = {
  homeIp: string | null
  homePort: number | null
  requestLogAvailable: boolean
  logHomeIpRequired: boolean
}

export type UsageErrorSummary = {
  statusCode: number | null
  message: string | null
  bodyPreview: string | null
}

export type UsageRecord = {
  id: string
  usageId: number
  timestamp: string
  requestId: string | null
  upstreamRequestId: string | null
  status: 'success' | 'failed'
  failed: boolean
  statusCode: number | null
  source: string | null
  executorType: string | null
  provider: string | null
  model: string | null
  originalModel: string | null
  endpoint: string | null
  serviceTier: string | null
  reasoningEffort: string | null
  tokens: UsageTokens
  performance: UsagePerformance
  client: UsageClientIdentity | null
  credential: UsageExecutionCredential | null
  billing: UsageBilling | null
  runtime: UsageRuntime
  error: UsageErrorSummary | null
}

export type UsageRecordsPage = {
  items: UsageRecord[]
  total: number
  limit: number
  offset: number
  sort: UsageSortKey
  sortableFields: UsageRecordSortableField[]
}

export type UsagePayloadSummary = {
  method: string | null
  stream: boolean | null
  messageCount: number | null
  toolCount: number | null
}

export type UsageRecordRelatedRequestLog = {
  requestId: string | null
  homeIp: string | null
  homePort: number | null
  downloadUrl: string | null
  available: boolean | null
  raw: Record<string, unknown>
}

export type UsageRecordRelated = {
  chargeId: string | null
  requestLog: UsageRecordRelatedRequestLog | null
  raw: Record<string, unknown>
}

export type UsageRecordDetail = {
  record: UsageRecord
  payloadSummary: UsagePayloadSummary | null
  logExcerpt: string[]
  related: UsageRecordRelated | null
}

export type UsageLiveSummary = {
  windowSeconds: number
  rpm: number
  tpm: number
  errorRate: number
  successRate: number
  p50LatencyMs: number
  p95LatencyMs: number
}

export type UsageTotals = {
  requestCount: number
  successCount: number
  failedCount: number
  errorRate: number
  successRate: number
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cachedTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  totalTokens: number
  totalAmount: number | null
  currency: string | null
  blendedCostPer1mTokens: number | null
  avgLatencyMs: number
  p50LatencyMs: number
  p95LatencyMs: number
  avgTtftMs: number | null
  activeUserCount: number
  activeClientKeyCount: number
  activeCredentialCount: number
  activeModelCount: number
}

export type UsageTrendBucket = {
  bucketStart: string
  bucketEnd: string
  requestCount: number
  successCount: number
  failedCount: number
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cachedTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  totalTokens: number
  totalAmount: number | null
  currency: string | null
  avgLatencyMs: number
  p95LatencyMs: number
}

export type UsageCostBreakdownItem = {
  category: UsageCostCategory
  amount: number | null
  percentage: number | null
  tokens: number | null
  billingBasis: string | null
}

export type UsageActivityBucket = {
  bucketStart: string
  bucketEnd: string
  requestCount: number
  successCount: number
  failedCount: number
  successRate: number
  errorRate: number
  status: UsageActivityStatus
}

export type UsageModelEfficiencyItem = {
  model: string
  provider: string | null
  requestCount: number
  totalTokens: number
  totalAmount: number | null
  currency: string | null
  costPer1mTokens: number | null
  avgLatencyMs: number | null
  p95LatencyMs: number | null
}

export type UsageQuotaWindow = {
  label: string
  mode: 'current' | 'estimated'
  windowSeconds: number | null
  windowStart: string | null
  windowEnd: string | null
  usedTokens: number | null
  usedAmount: number | null
  limitTokens: number | null
  limitAmount: number | null
  percentage: number | null
  status: UsageQuotaStatus
}

export type UsageAggregateComparison = {
  baselineFrom: string | null
  baselineTo: string | null
  requestCountDelta: number | null
  totalTokensDelta: number | null
  totalAmountDelta: number | null
  successRateDelta: number | null
  cacheRateDelta: number | null
}

export type UsageAggregateItem = {
  id: string
  label: string
  requestCount: number
  successCount: number
  failedCount: number
  successRate: number
  errorRate: number
  inputTokens: number | null
  outputTokens: number | null
  reasoningTokens: number | null
  cachedTokens: number | null
  cacheRate: number | null
  totalTokens: number
  totalAmount: number | null
  currency: string | null
  avgLatencyMs: number | null
  p95LatencyMs: number | null
  lastUsedAt: string | null
  comparison: UsageAggregateComparison | null
  quotaWindows: UsageQuotaWindow[]
  metadata: UnknownRecord
}

export type UsageOverview = {
  range: {
    from: string | null
    to: string | null
    timezone: string
    interval: string
  }
  live: UsageLiveSummary
  totals: UsageTotals
  trend: UsageTrendBucket[]
  costBreakdown: UsageCostBreakdownItem[]
  modelEfficiency: UsageModelEfficiencyItem[]
  top: {
    users: UsageAggregateItem[]
    clientKeys: UsageAggregateItem[]
    credentials: UsageAggregateItem[]
    providers: UsageAggregateItem[]
    models: UsageAggregateItem[]
    endpoints: UsageAggregateItem[]
    errors: UsageAggregateItem[]
  }
  activity: UsageActivityBucket[]
}

export type UsageAggregateResponse = {
  groupBy: string
  metric: string
  direction: UsageAggregateSortDirection
  items: UsageAggregateItem[]
  total: number
  limit: number
  offset: number
  sortableMetrics: UsageAggregateMetric[]
}

export type UsageHealthSubject = 'provider' | 'credential'

export type UsageHealthItem = {
  id: string
  label: string
  status: UsageHealthStatus
  provider: string | null
  credentialType: UsageCredentialType | null
  recentSuccessCount: number
  recentFailedCount: number
  recentErrorRate: number
  lastErrorAt: string | null
  lastErrorStatus: string | number | null
  lastErrorMessage: string | null
  nextRetryAt: string | null
  avgLatencyMs: number | null
  p95LatencyMs: number | null
}

export type UsageHealthResponse = {
  subject: UsageHealthSubject
  windowSeconds: number
  items: UsageHealthItem[]
}

export type UsageRealtimeVelocityBucket = {
  bucketStart: string
  bucketEnd: string
  rpm: number
  tpm: number
  errorRate: number
}

export type UsageRealtimeLatencyBucket = {
  bucket: string
  requestCount: number
}

export type UsageRealtimeCurrentUsageItem = {
  id: string
  label: string
  requestCount: number
  totalTokens: number
  totalAmount: number | null
  currency: string | null
}

export type UsageRealtimeSnapshot = {
  windowSeconds: number
  bucketSeconds: number
  updatedAt: string
  groupBy: UsageAggregateGroupBy
  velocity: UsageRealtimeVelocityBucket[]
  latencyDistribution: UsageRealtimeLatencyBucket[]
  currentUsage: UsageRealtimeCurrentUsageItem[]
}

export type UsageFilterOptions = {
  providers: string[]
  models: string[]
  credentialTypes: UsageCredentialType[]
  homeIps: string[]
  endpoints: string[]
  executorTypes: string[]
  statusCodes: string[]
}

export type UsageLogsSnapshot = {
  fetchedAt: string
  settings: UsageRuntimeSettings
  overview: UsageOverview | null
  records: UsageRecordsPage | null
  credentialUsage: UsageAggregateResponse | null
  providerHealth: UsageHealthResponse | null
  credentialHealth: UsageHealthResponse | null
  realtime: UsageRealtimeSnapshot | null
  requestLogs: RequestLogIndex | null
  apiKeyUsage: ApiKeyUsageResource[]
  runtimeLogs: RuntimeLogSnapshot | null
  requestErrorLogs: RequestErrorLogFile[]
  filterOptions: UsageFilterOptions
  issues: UsageLogIssue[]
}

export type RuntimeLogContext = {
  fetchedAt: string
  settings: UsageRuntimeSettings
  requestErrorLogs: RequestErrorLogFile[]
  issues: UsageLogIssue[]
}

type ClearLogsResult = {
  success: boolean
  message: string | null
  removed: number | null
}

export type LogDownloadResult = {
  blob: Blob
  fileName: string
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

function readTextFromKeys(record: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }

  return null
}

function readNumber(record: UnknownRecord, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
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

function readBooleanFromKeys(record: UnknownRecord, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = readBoolean(record, key)
    if (value !== null) return value
  }

  return null
}

function readConfigBoolean(record: UnknownRecord, key: string): boolean {
  return readBoolean(record, key) === true
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function hasOwnRecordKey(record: UnknownRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function readStringArrayValue(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
}

function normalizeUsageRecordSortableField(value: string): UsageRecordSortableField | null {
  if (
    value === 'timestamp' ||
    value === 'total_tokens' ||
    value === 'total_amount' ||
    value === 'latency_ms'
  ) {
    return value
  }

  return null
}

function normalizeUsageRecordSortableFields(responseData: UnknownRecord) {
  const rawValue = hasOwnRecordKey(responseData, 'sortable_fields')
    ? responseData.sortable_fields
    : hasOwnRecordKey(responseData, 'sortableFields')
      ? responseData.sortableFields
      : undefined
  if (rawValue === undefined) return defaultUsageRecordSortableFields
  const rawFields = readStringArrayValue(rawValue)
  if (!rawFields) return []

  return rawFields
    .map(normalizeUsageRecordSortableField)
    .filter((field): field is UsageRecordSortableField => field !== null)
}

function normalizeUsageAggregateMetric(value: string): UsageAggregateMetric | null {
  if (
    value === 'request_count' ||
    value === 'total_tokens' ||
    value === 'total_amount' ||
    value === 'failed_count' ||
    value === 'avg_latency_ms' ||
    value === 'p95_latency_ms'
  ) {
    return value
  }

  return null
}

function normalizeUsageAggregateSortableMetrics(responseData: UnknownRecord) {
  const rawValue = hasOwnRecordKey(responseData, 'sortable_metrics')
    ? responseData.sortable_metrics
    : hasOwnRecordKey(responseData, 'sortableMetrics')
      ? responseData.sortableMetrics
      : undefined
  if (rawValue === undefined) return defaultUsageAggregateSortableMetrics
  const rawMetrics = readStringArrayValue(rawValue)
  if (!rawMetrics) return []

  return rawMetrics
    .map(normalizeUsageAggregateMetric)
    .filter((metric): metric is UsageAggregateMetric => metric !== null)
}

function normalizeUsageSort(value: string | null): UsageSortKey {
  if (
    value === 'timestamp_desc' ||
    value === 'timestamp_asc' ||
    value === 'failed_first' ||
    value === 'tokens_desc' ||
    value === 'tokens_asc' ||
    value === 'cost_desc' ||
    value === 'cost_asc' ||
    value === 'latency_desc' ||
    value === 'latency_asc'
  ) {
    return value
  }

  return 'timestamp_desc'
}

function maskApiKey(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.length <= 10) return `${trimmed.slice(0, 2)}***`
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`
}

function splitUsageKey(value: string) {
  const separatorIndex = value.indexOf('|')

  if (separatorIndex < 0) {
    return {
      baseUrl: '',
      apiKeyPreview: maskApiKey(value),
    }
  }

  return {
    baseUrl: value.slice(0, separatorIndex),
    apiKeyPreview: maskApiKey(value.slice(separatorIndex + 1)),
  }
}

function normalizeIssue(scope: UsageLogIssueScope, error: unknown): UsageLogIssue {
  const apiError = toManagementApiError(error)

  return {
    scope,
    message: apiError.message,
    status: apiError.status,
    code: apiError.code,
  }
}

async function readOptional<T>(
  issues: UsageLogIssue[],
  scope: UsageLogIssueScope,
  request: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await request()
  } catch (error) {
    issues.push(normalizeIssue(scope, error))
    return fallback
  }
}

function normalizeApiKeyUsage(responseData: unknown): ApiKeyUsageResource[] {
  const root = toRecord(responseData)

  return Object.entries(root).flatMap(([provider, providerValue]) => {
    const providerRecord = toRecord(providerValue)

    return Object.entries(providerRecord).map(([usageKey, usageValue], index) => {
      const usageRecord = toRecord(usageValue)
      const recentRequests = usageRecord.recent_requests
      const keyParts = splitUsageKey(usageKey)

      return {
        id: `${provider}:${usageKey}:${index}`,
        provider,
        baseUrl: keyParts.baseUrl,
        apiKeyPreview: keyParts.apiKeyPreview,
        success: readNumber(usageRecord, 'success') ?? 0,
        failed: readNumber(usageRecord, 'failed') ?? 0,
        recentRequestCount: Array.isArray(recentRequests) ? recentRequests.length : 0,
      }
    })
  })
}

function readLogArray(record: UnknownRecord): unknown[] {
  const logs = record.logs
  if (Array.isArray(logs)) return logs
  return []
}

function normalizeRuntimeLogRecord(record: unknown, index: number): RuntimeLogRecord {
  const recordValue = toRecord(record)
  const idValue = readNumber(recordValue, 'id') ?? readString(recordValue, 'id')
  const timestamp = readString(recordValue, 'timestamp')
  const line = readString(recordValue, 'line') ?? ''
  const requestId = readString(recordValue, 'request_id') ?? readString(recordValue, 'request-id')
  const homeIp = readString(recordValue, 'home_ip') ?? readString(recordValue, 'home-ip')
  const homePort = readNumberFromKeys(recordValue, ['home_port', 'homePort', 'home-port'])

  return {
    id: idValue !== null ? String(idValue) : `runtime-log-${index + 1}`,
    timestamp,
    clientIp: readString(recordValue, 'client_ip') ?? readString(recordValue, 'client-ip'),
    requestId,
    homeIp,
    homePort,
    requestLogAvailable: Boolean(requestId && homeIp),
    level: readString(recordValue, 'level'),
    line,
    createdAt: readString(recordValue, 'created_at') ?? readString(recordValue, 'createdAt'),
    raw: record,
  }
}

function timestampToMilliseconds(value: string | null) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function normalizeRuntimeLogs(responseData: unknown, indexBase = 0): RuntimeLogSnapshot {
  const record = toRecord(responseData)
  const lines = record.lines
  const records = readLogArray(record).map((item, index) =>
    normalizeRuntimeLogRecord(item, indexBase + index),
  )
  const normalizedLines = Array.isArray(lines)
    ? lines.filter((line): line is string => typeof line === 'string')
    : records.map((item) => item.line).filter(Boolean)
  const latestRecordTimestamp = records
    .map((item) => timestampToMilliseconds(item.timestamp))
    .find((value): value is number => value !== null)

  return {
    lines: normalizedLines,
    records,
    lineCount:
      readNumber(record, 'line-count') ?? readNumber(record, 'total') ?? normalizedLines.length,
    latestTimestamp: readNumber(record, 'latest-timestamp') ?? latestRecordTimestamp ?? null,
    total: readNumber(record, 'total'),
    limit: readNumber(record, 'limit'),
    offset: readNumber(record, 'offset'),
  }
}

function normalizeRequestErrorLogs(responseData: unknown): RequestErrorLogFile[] {
  const files = toRecord(responseData).files
  if (!Array.isArray(files)) return []

  return files.filter(isRecord).map((record, index) => ({
    name: readString(record, 'name') ?? `error-log-${index + 1}.log`,
    size: readNumber(record, 'size'),
    modified: readNumber(record, 'modified'),
  }))
}

function normalizeRequestLogIndexItem(value: unknown, index: number): RequestLogIndexItem {
  const record = toRecord(value)
  const requestId =
    readTextFromKeys(record, ['request_id', 'requestId']) ?? `request-log-${index + 1}`
  const failed = readBoolean(record, 'failed')
  const statusText = readString(record, 'status')

  return {
    id: readTextFromKeys(record, ['id']) ?? `${requestId}:${index}`,
    requestId,
    timestamp:
      readString(record, 'timestamp') ?? readStringFromKeys(record, ['created_at', 'createdAt']),
    homeIp: readStringFromKeys(record, ['home_ip', 'homeIp']),
    homePort: readNumberFromKeys(record, ['home_port', 'homePort']),
    fileName: readStringFromKeys(record, ['file_name', 'fileName', 'name']),
    sizeBytes: readNumberFromKeys(record, ['size_bytes', 'sizeBytes', 'size']),
    available: readBoolean(record, 'available') ?? true,
    provider: readString(record, 'provider'),
    model: readString(record, 'model'),
    status:
      statusText === 'success' || failed === false
        ? 'success'
        : statusText === 'failed' || failed === true
          ? 'failed'
          : 'unknown',
    downloadUrl: readStringFromKeys(record, ['download_url', 'downloadUrl']),
  }
}

function normalizeRequestLogIndex(responseData: unknown): RequestLogIndex {
  const root = toRecord(responseData)
  const items = readArray(root.items ?? root.logs ?? responseData).map(normalizeRequestLogIndexItem)

  return {
    items,
    total: readNumber(root, 'total') ?? items.length,
    limit: readNumber(root, 'limit') ?? items.length,
    offset: readNumber(root, 'offset') ?? 0,
  }
}

function normalizeTokens(value: unknown): UsageTokens {
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

function normalizePerformance(value: unknown): UsagePerformance {
  const record = toRecord(value)

  return {
    latencyMs: readNumberFromKeys(record, ['latency_ms', 'latencyMs']) ?? 0,
    ttftMs: readNumberFromKeys(record, ['ttft_ms', 'ttftMs']),
    tps: readNumber(record, 'tps'),
  }
}

function normalizeClient(value: unknown): UsageClientIdentity | null {
  if (!isRecord(value)) return null

  return {
    apiKeyId: readNumberFromKeys(value, ['api_key_id', 'apiKeyId']),
    apiKeyLabel: readStringFromKeys(value, ['api_key_label', 'apiKeyLabel']),
    apiKeyMasked: readStringFromKeys(value, ['api_key_masked', 'apiKeyMasked']),
    userId: readNumberFromKeys(value, ['user_id', 'userId']),
    username: readString(value, 'username'),
    clientIp: readStringFromKeys(value, ['client_ip', 'clientIp']),
  }
}

function normalizeCredential(value: unknown): UsageExecutionCredential | null {
  if (!isRecord(value)) return null
  const credentialType =
    readStringFromKeys(value, ['credential_type', 'credentialType']) ?? 'unknown'

  return {
    credentialType: normalizeCredentialType(credentialType),
    credentialId: readStringFromKeys(value, ['credential_id', 'credentialId']),
    authIndex: readStringFromKeys(value, ['auth_index', 'authIndex']),
    provider: readString(value, 'provider'),
    label: readString(value, 'label'),
    source: readString(value, 'source'),
    status: readString(value, 'status'),
    apiKeyPreview: readStringFromKeys(value, ['api_key_preview', 'apiKeyPreview']),
  }
}

function normalizeCredentialType(value: string): UsageCredentialType {
  if (value === 'provider_api_key' || value === 'oauth' || value === 'file_auth') return value
  if (value === 'vertex') return value
  return 'unknown'
}

function normalizeCostCategory(value: string | null): UsageCostCategory {
  if (
    value === 'input' ||
    value === 'output' ||
    value === 'cache' ||
    value === 'reasoning' ||
    value === 'request'
  ) {
    return value
  }

  return 'other'
}

function normalizeQuotaWindowMode(value: string | null): UsageQuotaWindow['mode'] {
  return value === 'estimated' ? 'estimated' : 'current'
}

function normalizeAggregateComparison(value: unknown): UsageAggregateComparison | null {
  if (!value || typeof value !== 'object') return null

  const record = toRecord(value)

  return {
    baselineFrom: readStringFromKeys(record, ['baseline_from', 'baselineFrom']),
    baselineTo: readStringFromKeys(record, ['baseline_to', 'baselineTo']),
    requestCountDelta: readNumberFromKeys(record, ['request_count_delta', 'requestCountDelta']),
    totalTokensDelta: readNumberFromKeys(record, ['total_tokens_delta', 'totalTokensDelta']),
    totalAmountDelta: readNumberFromKeys(record, ['total_amount_delta', 'totalAmountDelta']),
    successRateDelta: readNumberFromKeys(record, ['success_rate_delta', 'successRateDelta']),
    cacheRateDelta: readNumberFromKeys(record, ['cache_rate_delta', 'cacheRateDelta']),
  }
}

function normalizeActivityStatus(value: string | null): UsageActivityStatus {
  if (
    value === 'empty' ||
    value === 'healthy' ||
    value === 'warning' ||
    value === 'degraded' ||
    value === 'failed'
  ) {
    return value
  }

  return 'empty'
}

function normalizeUsageHealthStatus(value: string | null): UsageHealthStatus {
  if (
    value === 'healthy' ||
    value === 'degraded' ||
    value === 'unavailable' ||
    value === 'disabled'
  ) {
    return value
  }

  return 'unknown'
}

function normalizeQuotaStatus(value: string | null): UsageQuotaStatus {
  if (value === 'ok' || value === 'warning' || value === 'exceeded') return value
  return 'unknown'
}

function normalizeBilling(value: unknown): UsageBilling | null {
  if (!isRecord(value)) return null

  return {
    chargeId: readStringFromKeys(value, ['charge_id', 'chargeId']),
    amount: readNumber(value, 'amount'),
    currency: readString(value, 'currency'),
    matchedPriceRule: readStringFromKeys(value, ['matched_price_rule', 'matchedPriceRule']),
    balanceBefore: readNumberFromKeys(value, ['balance_before', 'balanceBefore']),
    balanceAfter: readNumberFromKeys(value, ['balance_after', 'balanceAfter']),
  }
}

function normalizeUsageRuntime(value: unknown): UsageRuntime {
  const record = toRecord(value)

  return {
    homeIp: readStringFromKeys(record, ['home_ip', 'homeIp']),
    homePort: readNumberFromKeys(record, ['home_port', 'homePort']),
    requestLogAvailable:
      readBooleanFromKeys(record, ['request_log_available', 'requestLogAvailable']) === true,
    logHomeIpRequired:
      readBooleanFromKeys(record, ['log_home_ip_required', 'logHomeIpRequired']) === true,
  }
}

function normalizeErrorSummary(value: unknown): UsageErrorSummary | null {
  if (!isRecord(value)) return null

  return {
    statusCode: readNumberFromKeys(value, ['status_code', 'statusCode']),
    message: readString(value, 'message'),
    bodyPreview: readStringFromKeys(value, ['body_preview', 'bodyPreview']),
  }
}

function normalizeUsageRecord(value: unknown, index: number): UsageRecord {
  const record = toRecord(value)
  const usageId = readNumberFromKeys(record, ['usage_id', 'usageId']) ?? index + 1
  const failed =
    readBoolean(record, 'failed') ?? readString(record, 'status')?.toLowerCase() === 'failed'

  return {
    id: readString(record, 'id') ?? String(usageId),
    usageId,
    timestamp: readString(record, 'timestamp') ?? new Date().toISOString(),
    requestId: readStringFromKeys(record, ['request_id', 'requestId']),
    upstreamRequestId: readStringFromKeys(record, ['upstream_request_id', 'upstreamRequestId']),
    status: failed ? 'failed' : 'success',
    failed,
    statusCode: readNumberFromKeys(record, ['status_code', 'statusCode']),
    source: readString(record, 'source'),
    executorType: readStringFromKeys(record, ['executor_type', 'executorType']),
    provider: readString(record, 'provider'),
    model: readString(record, 'model'),
    originalModel: readStringFromKeys(record, ['original_model', 'originalModel']),
    endpoint: readString(record, 'endpoint'),
    serviceTier: readStringFromKeys(record, ['service_tier', 'serviceTier']),
    reasoningEffort: readStringFromKeys(record, ['reasoning_effort', 'reasoningEffort']),
    tokens: normalizeTokens(record.tokens),
    performance: normalizePerformance(record.performance),
    client: normalizeClient(record.client),
    credential: normalizeCredential(record.credential),
    billing: normalizeBilling(record.billing),
    runtime: normalizeUsageRuntime(record.runtime),
    error: normalizeErrorSummary(record.error),
  }
}

function normalizeUsageRecordsPage(responseData: unknown): UsageRecordsPage {
  const root = toRecord(responseData)
  const items = readArray(root.items).map(normalizeUsageRecord)

  return {
    items,
    total: readNumber(root, 'total') ?? items.length,
    limit: readNumber(root, 'limit') ?? items.length,
    offset: readNumber(root, 'offset') ?? 0,
    sort: normalizeUsageSort(readString(root, 'sort')),
    sortableFields: normalizeUsageRecordSortableFields(root),
  }
}

function normalizeUsageRecordDetail(responseData: unknown): UsageRecordDetail {
  const root = toRecord(responseData)
  const record = normalizeUsageRecord(root.record ?? root, 0)
  const payload = toRecord(root.payload_summary ?? root.payloadSummary)
  const related = normalizeUsageRecordRelated(root.related)
  const logExcerpt = readArray(root.log_excerpt ?? root.logExcerpt).filter(
    (line): line is string => typeof line === 'string',
  )

  return {
    record,
    payloadSummary: isRecord(root.payload_summary ?? root.payloadSummary)
      ? {
          method: readString(payload, 'method'),
          stream: readBoolean(payload, 'stream'),
          messageCount: readNumberFromKeys(payload, ['message_count', 'messageCount']),
          toolCount: readNumberFromKeys(payload, ['tool_count', 'toolCount']),
        }
      : null,
    logExcerpt,
    related,
  }
}

function normalizeUsageRecordRelated(value: unknown): UsageRecordRelated | null {
  if (!isRecord(value)) return null
  const rawRequestLog = value.request_log ?? value.requestLog
  const requestLog = isRecord(rawRequestLog)
    ? {
        requestId: readStringFromKeys(rawRequestLog, ['request_id', 'requestId']),
        homeIp: readStringFromKeys(rawRequestLog, ['home_ip', 'homeIp']),
        homePort: readNumberFromKeys(rawRequestLog, ['home_port', 'homePort']),
        downloadUrl: readStringFromKeys(rawRequestLog, ['download_url', 'downloadUrl']),
        available: readBoolean(rawRequestLog, 'available'),
        raw: rawRequestLog,
      }
    : null

  return {
    chargeId: readStringFromKeys(value, ['charge_id', 'chargeId']),
    requestLog,
    raw: value,
  }
}

function normalizeAggregateItem(value: unknown, index: number): UsageAggregateItem {
  const record = toRecord(value)
  const requestCount = readNumberFromKeys(record, ['request_count', 'requestCount']) ?? 0
  const successCount = readNumberFromKeys(record, ['success_count', 'successCount']) ?? 0
  const failedCount = readNumberFromKeys(record, ['failed_count', 'failedCount']) ?? 0

  return {
    id: readString(record, 'id') ?? `aggregate-${index + 1}`,
    label: readString(record, 'label') ?? readString(record, 'id') ?? `#${index + 1}`,
    requestCount,
    successCount,
    failedCount,
    successRate:
      readNumberFromKeys(record, ['success_rate', 'successRate']) ??
      (requestCount > 0 ? successCount / requestCount : 0),
    errorRate:
      readNumberFromKeys(record, ['error_rate', 'errorRate']) ??
      (requestCount > 0 ? failedCount / requestCount : 0),
    inputTokens: readNumberFromKeys(record, ['input_tokens', 'inputTokens']),
    outputTokens: readNumberFromKeys(record, ['output_tokens', 'outputTokens']),
    reasoningTokens: readNumberFromKeys(record, ['reasoning_tokens', 'reasoningTokens']),
    cachedTokens: readNumberFromKeys(record, ['cached_tokens', 'cachedTokens']),
    cacheRate: readNumberFromKeys(record, ['cache_rate', 'cacheRate']),
    totalTokens: readNumberFromKeys(record, ['total_tokens', 'totalTokens']) ?? 0,
    totalAmount: readNumberFromKeys(record, ['total_amount', 'totalAmount']),
    currency: readString(record, 'currency'),
    avgLatencyMs: readNumberFromKeys(record, ['avg_latency_ms', 'avgLatencyMs']),
    p95LatencyMs: readNumberFromKeys(record, ['p95_latency_ms', 'p95LatencyMs']),
    lastUsedAt: readStringFromKeys(record, ['last_used_at', 'lastUsedAt']),
    comparison: normalizeAggregateComparison(record.comparison),
    quotaWindows: readArray(record.quota_windows ?? record.quotaWindows).map(normalizeQuotaWindow),
    metadata: toRecord(record.metadata),
  }
}

function normalizeAggregateItems(value: unknown): UsageAggregateItem[] {
  return readArray(value).map(normalizeAggregateItem)
}

function normalizeAggregateResponse(responseData: unknown): UsageAggregateResponse {
  const root = toRecord(responseData)
  const items = normalizeAggregateItems(root.items)

  return {
    groupBy: readStringFromKeys(root, ['group_by', 'groupBy']) ?? 'unknown',
    metric: readString(root, 'metric') ?? 'request_count',
    direction: readString(root, 'direction') === 'asc' ? 'asc' : 'desc',
    items,
    total: readNumber(root, 'total') ?? items.length,
    limit: readNumber(root, 'limit') ?? items.length,
    offset: readNumber(root, 'offset') ?? 0,
    sortableMetrics: normalizeUsageAggregateSortableMetrics(root),
  }
}

function normalizeUsageHealthItem(value: unknown, index: number): UsageHealthItem {
  const record = toRecord(value)
  const status = normalizeUsageHealthStatus(readString(record, 'status'))
  const credentialType = readStringFromKeys(record, ['credential_type', 'credentialType'])

  return {
    id: readTextFromKeys(record, ['id']) ?? `health-${index + 1}`,
    label: readString(record, 'label') ?? readTextFromKeys(record, ['id']) ?? `#${index + 1}`,
    status,
    provider: readString(record, 'provider'),
    credentialType: credentialType ? normalizeCredentialType(credentialType) : null,
    recentSuccessCount:
      readNumberFromKeys(record, ['recent_success_count', 'recentSuccessCount']) ?? 0,
    recentFailedCount:
      readNumberFromKeys(record, ['recent_failed_count', 'recentFailedCount']) ?? 0,
    recentErrorRate: readNumberFromKeys(record, ['recent_error_rate', 'recentErrorRate']) ?? 0,
    lastErrorAt: readStringFromKeys(record, ['last_error_at', 'lastErrorAt']),
    lastErrorStatus:
      readNumberFromKeys(record, ['last_error_status', 'lastErrorStatus']) ??
      readStringFromKeys(record, ['last_error_status', 'lastErrorStatus']),
    lastErrorMessage: readStringFromKeys(record, ['last_error_message', 'lastErrorMessage']),
    nextRetryAt: readStringFromKeys(record, ['next_retry_at', 'nextRetryAt']),
    avgLatencyMs: readNumberFromKeys(record, ['avg_latency_ms', 'avgLatencyMs']),
    p95LatencyMs: readNumberFromKeys(record, ['p95_latency_ms', 'p95LatencyMs']),
  }
}

function normalizeUsageHealthResponse(
  responseData: unknown,
  subject: UsageHealthSubject,
): UsageHealthResponse {
  const root = toRecord(responseData)
  const rawItems = Array.isArray(responseData)
    ? responseData
    : readArray(root.items ?? root[subject === 'provider' ? 'providers' : 'credentials'])

  return {
    subject,
    windowSeconds: readNumberFromKeys(root, ['window_seconds', 'windowSeconds']) ?? 300,
    items: rawItems.map(normalizeUsageHealthItem),
  }
}

function normalizeUsageRealtimeVelocityBucket(value: unknown): UsageRealtimeVelocityBucket {
  const record = toRecord(value)

  return {
    bucketStart: readStringFromKeys(record, ['bucket_start', 'bucketStart']) ?? '',
    bucketEnd: readStringFromKeys(record, ['bucket_end', 'bucketEnd']) ?? '',
    rpm: readNumber(record, 'rpm') ?? 0,
    tpm: readNumber(record, 'tpm') ?? 0,
    errorRate: readNumberFromKeys(record, ['error_rate', 'errorRate']) ?? 0,
  }
}

function normalizeUsageRealtimeLatencyBucket(value: unknown): UsageRealtimeLatencyBucket {
  const record = toRecord(value)

  return {
    bucket: readTextFromKeys(record, ['bucket', 'label']) ?? 'unknown',
    requestCount: readNumberFromKeys(record, ['request_count', 'requestCount']) ?? 0,
  }
}

function normalizeUsageRealtimeCurrentUsageItem(
  value: unknown,
  index: number,
): UsageRealtimeCurrentUsageItem {
  const record = toRecord(value)
  const id = readTextFromKeys(record, ['id']) ?? `current-usage-${index + 1}`

  return {
    id,
    label: readString(record, 'label') ?? id,
    requestCount: readNumberFromKeys(record, ['request_count', 'requestCount']) ?? 0,
    totalTokens: readNumberFromKeys(record, ['total_tokens', 'totalTokens']) ?? 0,
    totalAmount: readNumberFromKeys(record, ['total_amount', 'totalAmount']),
    currency: readString(record, 'currency'),
  }
}

function normalizeRealtimeGroupBy(value: string | null): UsageAggregateGroupBy {
  if (
    value === 'user' ||
    value === 'client_key' ||
    value === 'credential' ||
    value === 'provider' ||
    value === 'model' ||
    value === 'endpoint' ||
    value === 'home_ip' ||
    value === 'executor_type' ||
    value === 'status_code'
  ) {
    return value
  }

  return 'model'
}

function normalizeUsageRealtimeSnapshot(responseData: unknown): UsageRealtimeSnapshot {
  const root = toRecord(responseData)

  return {
    windowSeconds: readNumberFromKeys(root, ['window_seconds', 'windowSeconds']) ?? 900,
    bucketSeconds: readNumberFromKeys(root, ['bucket_seconds', 'bucketSeconds']) ?? 60,
    updatedAt: readStringFromKeys(root, ['updated_at', 'updatedAt']) ?? new Date().toISOString(),
    groupBy: normalizeRealtimeGroupBy(readStringFromKeys(root, ['group_by', 'groupBy'])),
    velocity: readArray(root.velocity).map(normalizeUsageRealtimeVelocityBucket),
    latencyDistribution: readArray(root.latency_distribution ?? root.latencyDistribution).map(
      normalizeUsageRealtimeLatencyBucket,
    ),
    currentUsage: readArray(root.current_usage ?? root.currentUsage).map(
      normalizeUsageRealtimeCurrentUsageItem,
    ),
  }
}

function normalizeTotals(value: unknown): UsageTotals {
  const record = toRecord(value)

  return {
    requestCount: readNumberFromKeys(record, ['request_count', 'requestCount']) ?? 0,
    successCount: readNumberFromKeys(record, ['success_count', 'successCount']) ?? 0,
    failedCount: readNumberFromKeys(record, ['failed_count', 'failedCount']) ?? 0,
    errorRate: readNumberFromKeys(record, ['error_rate', 'errorRate']) ?? 0,
    successRate: readNumberFromKeys(record, ['success_rate', 'successRate']) ?? 0,
    inputTokens: readNumberFromKeys(record, ['input_tokens', 'inputTokens']) ?? 0,
    outputTokens: readNumberFromKeys(record, ['output_tokens', 'outputTokens']) ?? 0,
    reasoningTokens: readNumberFromKeys(record, ['reasoning_tokens', 'reasoningTokens']) ?? 0,
    cachedTokens: readNumberFromKeys(record, ['cached_tokens', 'cachedTokens']) ?? 0,
    cacheReadTokens: readNumberFromKeys(record, ['cache_read_tokens', 'cacheReadTokens']) ?? 0,
    cacheCreationTokens:
      readNumberFromKeys(record, ['cache_creation_tokens', 'cacheCreationTokens']) ?? 0,
    totalTokens: readNumberFromKeys(record, ['total_tokens', 'totalTokens']) ?? 0,
    totalAmount: readNumberFromKeys(record, ['total_amount', 'totalAmount']),
    currency: readString(record, 'currency'),
    blendedCostPer1mTokens: readNumberFromKeys(record, [
      'blended_cost_per_1m_tokens',
      'blendedCostPer1mTokens',
    ]),
    avgLatencyMs: readNumberFromKeys(record, ['avg_latency_ms', 'avgLatencyMs']) ?? 0,
    p50LatencyMs: readNumberFromKeys(record, ['p50_latency_ms', 'p50LatencyMs']) ?? 0,
    p95LatencyMs: readNumberFromKeys(record, ['p95_latency_ms', 'p95LatencyMs']) ?? 0,
    avgTtftMs: readNumberFromKeys(record, ['avg_ttft_ms', 'avgTtftMs']),
    activeUserCount: readNumberFromKeys(record, ['active_user_count', 'activeUserCount']) ?? 0,
    activeClientKeyCount:
      readNumberFromKeys(record, ['active_client_key_count', 'activeClientKeyCount']) ?? 0,
    activeCredentialCount:
      readNumberFromKeys(record, ['active_credential_count', 'activeCredentialCount']) ?? 0,
    activeModelCount: readNumberFromKeys(record, ['active_model_count', 'activeModelCount']) ?? 0,
  }
}

function normalizeLiveSummary(value: unknown): UsageLiveSummary {
  const record = toRecord(value)

  return {
    windowSeconds: readNumberFromKeys(record, ['window_seconds', 'windowSeconds']) ?? 300,
    rpm: readNumber(record, 'rpm') ?? 0,
    tpm: readNumber(record, 'tpm') ?? 0,
    errorRate: readNumberFromKeys(record, ['error_rate', 'errorRate']) ?? 0,
    successRate: readNumberFromKeys(record, ['success_rate', 'successRate']) ?? 0,
    p50LatencyMs: readNumberFromKeys(record, ['p50_latency_ms', 'p50LatencyMs']) ?? 0,
    p95LatencyMs: readNumberFromKeys(record, ['p95_latency_ms', 'p95LatencyMs']) ?? 0,
  }
}

function normalizeTrendBucket(value: unknown): UsageTrendBucket {
  const record = toRecord(value)

  return {
    bucketStart: readStringFromKeys(record, ['bucket_start', 'bucketStart']) ?? '',
    bucketEnd: readStringFromKeys(record, ['bucket_end', 'bucketEnd']) ?? '',
    requestCount: readNumberFromKeys(record, ['request_count', 'requestCount']) ?? 0,
    successCount: readNumberFromKeys(record, ['success_count', 'successCount']) ?? 0,
    failedCount: readNumberFromKeys(record, ['failed_count', 'failedCount']) ?? 0,
    inputTokens: readNumberFromKeys(record, ['input_tokens', 'inputTokens']) ?? 0,
    outputTokens: readNumberFromKeys(record, ['output_tokens', 'outputTokens']) ?? 0,
    reasoningTokens: readNumberFromKeys(record, ['reasoning_tokens', 'reasoningTokens']) ?? 0,
    cachedTokens: readNumberFromKeys(record, ['cached_tokens', 'cachedTokens']) ?? 0,
    cacheReadTokens: readNumberFromKeys(record, ['cache_read_tokens', 'cacheReadTokens']) ?? 0,
    cacheCreationTokens:
      readNumberFromKeys(record, ['cache_creation_tokens', 'cacheCreationTokens']) ?? 0,
    totalTokens: readNumberFromKeys(record, ['total_tokens', 'totalTokens']) ?? 0,
    totalAmount: readNumberFromKeys(record, ['total_amount', 'totalAmount']),
    currency: readString(record, 'currency'),
    avgLatencyMs: readNumberFromKeys(record, ['avg_latency_ms', 'avgLatencyMs']) ?? 0,
    p95LatencyMs: readNumberFromKeys(record, ['p95_latency_ms', 'p95LatencyMs']) ?? 0,
  }
}

function normalizeCostBreakdownItem(value: unknown): UsageCostBreakdownItem {
  const record = toRecord(value)

  return {
    category: normalizeCostCategory(readString(record, 'category')),
    amount: readNumber(record, 'amount'),
    percentage: readNumber(record, 'percentage'),
    tokens: readNumber(record, 'tokens'),
    billingBasis: readStringFromKeys(record, ['billing_basis', 'billingBasis']),
  }
}

function normalizeActivityBucket(value: unknown): UsageActivityBucket {
  const record = toRecord(value)
  const requestCount = readNumberFromKeys(record, ['request_count', 'requestCount']) ?? 0
  const successCount = readNumberFromKeys(record, ['success_count', 'successCount']) ?? 0
  const failedCount = readNumberFromKeys(record, ['failed_count', 'failedCount']) ?? 0

  return {
    bucketStart:
      readStringFromKeys(record, ['bucket_start', 'bucketStart']) ??
      readString(record, 'date') ??
      '',
    bucketEnd:
      readStringFromKeys(record, ['bucket_end', 'bucketEnd']) ?? readString(record, 'date') ?? '',
    requestCount,
    successCount,
    failedCount,
    successRate:
      readNumberFromKeys(record, ['success_rate', 'successRate']) ??
      (requestCount > 0 ? successCount / requestCount : 0),
    errorRate:
      readNumberFromKeys(record, ['error_rate', 'errorRate']) ??
      (requestCount > 0 ? failedCount / requestCount : 0),
    status: normalizeActivityStatus(readString(record, 'status')),
  }
}

function normalizeModelEfficiencyItem(value: unknown): UsageModelEfficiencyItem {
  const record = toRecord(value)

  return {
    model: readString(record, 'model') ?? 'unknown',
    provider: readString(record, 'provider'),
    requestCount: readNumberFromKeys(record, ['request_count', 'requestCount']) ?? 0,
    totalTokens: readNumberFromKeys(record, ['total_tokens', 'totalTokens']) ?? 0,
    totalAmount: readNumberFromKeys(record, ['total_amount', 'totalAmount']),
    currency: readString(record, 'currency'),
    costPer1mTokens: readNumberFromKeys(record, ['cost_per_1m_tokens', 'costPer1mTokens']),
    avgLatencyMs: readNumberFromKeys(record, ['avg_latency_ms', 'avgLatencyMs']),
    p95LatencyMs: readNumberFromKeys(record, ['p95_latency_ms', 'p95LatencyMs']),
  }
}

function normalizeQuotaWindow(value: unknown): UsageQuotaWindow {
  const record = toRecord(value)

  return {
    label: readString(record, 'label') ?? 'window',
    mode: normalizeQuotaWindowMode(readString(record, 'mode')),
    windowSeconds: readNumberFromKeys(record, ['window_seconds', 'windowSeconds']),
    windowStart: readStringFromKeys(record, ['window_start', 'windowStart']),
    windowEnd: readStringFromKeys(record, ['window_end', 'windowEnd']),
    usedTokens: readNumberFromKeys(record, ['used_tokens', 'usedTokens']),
    usedAmount: readNumberFromKeys(record, ['used_amount', 'usedAmount']),
    limitTokens: readNumberFromKeys(record, ['limit_tokens', 'limitTokens']),
    limitAmount: readNumberFromKeys(record, ['limit_amount', 'limitAmount']),
    percentage: readNumber(record, 'percentage'),
    status: normalizeQuotaStatus(readString(record, 'status')),
  }
}

function normalizeUsageOverview(responseData: unknown): UsageOverview {
  const root = toRecord(responseData)
  const range = toRecord(root.range)
  const top = toRecord(root.top)

  return {
    range: {
      from: readString(range, 'from'),
      to: readString(range, 'to'),
      timezone: readString(range, 'timezone') ?? 'UTC',
      interval: readString(range, 'interval') ?? 'auto',
    },
    live: normalizeLiveSummary(root.live),
    totals: normalizeTotals(root.totals),
    trend: readArray(root.trend).map(normalizeTrendBucket),
    costBreakdown: readArray(root.cost_breakdown ?? root.costBreakdown).map(
      normalizeCostBreakdownItem,
    ),
    modelEfficiency: readArray(root.model_efficiency ?? root.modelEfficiency).map(
      normalizeModelEfficiencyItem,
    ),
    top: {
      users: normalizeAggregateItems(top.users),
      clientKeys: normalizeAggregateItems(top.client_keys ?? top.clientKeys),
      credentials: normalizeAggregateItems(top.credentials),
      providers: normalizeAggregateItems(top.providers),
      models: normalizeAggregateItems(top.models),
      endpoints: normalizeAggregateItems(top.endpoints),
      errors: normalizeAggregateItems(top.errors),
    },
    activity: readArray(root.activity).map(normalizeActivityBucket),
  }
}

function getTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function startOfLocalDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function parseDateOnly(value: string, boundary: 'start' | 'end') {
  const trimmed = value.trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!match) return null

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return null

  if (boundary === 'end') {
    date.setHours(23, 59, 59, 999)
  } else {
    date.setHours(0, 0, 0, 0)
  }

  return date
}

function getDateRange(filters: UsageFilters) {
  const now = new Date()
  const range = filters.range

  if (range === 'custom') {
    const from = parseDateOnly(filters.customFrom, 'start')
    const to = parseDateOnly(filters.customTo, 'end')

    return {
      from: from?.toISOString(),
      to: to?.toISOString(),
    }
  }

  if (range === '4h' || range === '12h' || range === '24h') {
    const hours = range === '4h' ? 4 : range === '12h' ? 12 : 24
    return {
      from: new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
    }
  }

  if (range === 'today') {
    return {
      from: startOfLocalDay(now).toISOString(),
      to: now.toISOString(),
    }
  }

  if (range === 'yesterday') {
    const todayStart = startOfLocalDay(now)
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(todayStart.getDate() - 1)

    return {
      from: yesterdayStart.toISOString(),
      to: todayStart.toISOString(),
    }
  }

  const days = range === '90d' ? 90 : range === '30d' ? 30 : 7
  const from = new Date(now)
  from.setDate(now.getDate() - days + 1)
  from.setHours(0, 0, 0, 0)

  return {
    from: from.toISOString(),
    to: now.toISOString(),
  }
}

function getUsageScopeQueryParams(filters: UsageFilters) {
  const range = getDateRange(filters)

  return {
    from: range.from,
    to: range.to,
    timezone: getTimeZone(),
    ...(filters.provider !== 'all' ? { provider: filters.provider } : {}),
    ...(filters.model !== 'all' ? { model: filters.model } : {}),
    ...(filters.credentialType !== 'all' ? { credential_type: filters.credentialType } : {}),
    ...(filters.homeIp !== 'all' ? { home_ip: filters.homeIp } : {}),
    ...(filters.endpoint !== 'all' ? { endpoint: filters.endpoint } : {}),
  }
}

function getUsageRecordQueryParams(filters: UsageFilters, pagination = true) {
  const trimmedRequestId = filters.requestId.trim()
  const trimmedUser = filters.user.trim()
  const trimmedClientKey = filters.clientKey.trim()
  const trimmedCredentialId = filters.credentialId.trim()
  const trimmedAuthIndex = filters.authIndex.trim()
  const trimmedMinLatencyMs = filters.minLatencyMs.trim()
  const trimmedMaxLatencyMs = filters.maxLatencyMs.trim()
  const trimmedMinAmount = filters.minAmount.trim()
  const trimmedMaxAmount = filters.maxAmount.trim()

  return {
    ...getUsageScopeQueryParams(filters),
    ...(pagination ? { limit: filters.limit, offset: filters.offset } : {}),
    ...(pagination && filters.sort ? { sort: filters.sort } : {}),
    ...(filters.status !== 'all' ? { status: filters.status } : {}),
    ...(filters.executorType !== 'all' ? { executor_type: filters.executorType } : {}),
    ...(filters.statusCode !== 'all' ? { status_code: filters.statusCode } : {}),
    ...(trimmedRequestId ? { request_id: trimmedRequestId } : {}),
    ...(trimmedUser ? { user: trimmedUser } : {}),
    ...(trimmedClientKey ? { client_key: trimmedClientKey } : {}),
    ...(trimmedCredentialId ? { credential_id: trimmedCredentialId } : {}),
    ...(trimmedAuthIndex ? { auth_index: trimmedAuthIndex } : {}),
    ...(trimmedMinLatencyMs ? { min_latency_ms: trimmedMinLatencyMs } : {}),
    ...(trimmedMaxLatencyMs ? { max_latency_ms: trimmedMaxLatencyMs } : {}),
    ...(trimmedMinAmount ? { min_amount: trimmedMinAmount } : {}),
    ...(trimmedMaxAmount ? { max_amount: trimmedMaxAmount } : {}),
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
  }
}

function normalizeRuntimeLogTimeFilter(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString()
}

function getRuntimeLogQueryParams(query: RuntimeLogQuery) {
  const homeIp = query.homeIp.trim()
  const clientIp = query.clientIp.trim()
  const requestId = query.requestId.trim()
  const after = normalizeRuntimeLogTimeFilter(query.after)
  const before = normalizeRuntimeLogTimeFilter(query.before)

  return {
    limit: query.limit,
    offset: query.offset,
    ...(homeIp ? { home_ip: homeIp } : {}),
    ...(clientIp ? { client_ip: clientIp } : {}),
    ...(requestId ? { request_id: requestId } : {}),
    ...(query.level !== 'all' ? { level: query.level } : {}),
    ...(after ? { after } : {}),
    ...(before ? { before } : {}),
  }
}

function deriveFilterOptions({
  overview,
  records,
  credentialUsage,
}: {
  overview: UsageOverview | null
  records: UsageRecordsPage | null
  credentialUsage: UsageAggregateResponse | null
}): UsageFilterOptions {
  const providers = new Set<string>()
  const models = new Set<string>()
  const credentialTypes = new Set<UsageCredentialType>()
  const homeIps = new Set<string>()
  const endpoints = new Set<string>()
  const executorTypes = new Set<string>()
  const statusCodes = new Set<string>()

  overview?.top.providers.forEach((item) => providers.add(item.label))
  overview?.top.models.forEach((item) => models.add(item.label))
  overview?.top.endpoints.forEach((item) => endpoints.add(item.label))
  overview?.top.errors.forEach((item) => statusCodes.add(item.id))
  overview?.top.credentials.forEach((item) => {
    const credentialType = readStringFromKeys(item.metadata, ['credential_type', 'credentialType'])
    if (credentialType) credentialTypes.add(normalizeCredentialType(credentialType))
  })
  credentialUsage?.items.forEach((item) => {
    const credentialType = readStringFromKeys(item.metadata, ['credential_type', 'credentialType'])
    const provider = readString(item.metadata, 'provider')
    if (credentialType) credentialTypes.add(normalizeCredentialType(credentialType))
    if (provider) providers.add(provider)
  })
  records?.items.forEach((record) => {
    if (record.provider) providers.add(record.provider)
    if (record.model) models.add(record.model)
    if (record.credential?.credentialType) credentialTypes.add(record.credential.credentialType)
    if (record.runtime.homeIp) homeIps.add(record.runtime.homeIp)
    if (record.endpoint) endpoints.add(record.endpoint)
    if (record.executorType) executorTypes.add(record.executorType)
    if (record.statusCode !== null) statusCodes.add(String(record.statusCode))
  })

  return {
    providers: [...providers].sort(),
    models: [...models].sort(),
    credentialTypes: [...credentialTypes].sort(),
    homeIps: [...homeIps].sort(),
    endpoints: [...endpoints].sort(),
    executorTypes: [...executorTypes].sort(),
    statusCodes: [...statusCodes].sort((left, right) => Number(left) - Number(right)),
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

export async function fetchUsageLogsSnapshot(
  session: ManagementSessionInput,
  capabilities: CapabilityMap,
  filters: UsageFilters,
): Promise<UsageLogsSnapshot> {
  const client = createManagementClient(session)
  const issues: UsageLogIssue[] = []
  const configResponse = await client.get<unknown>('/config')
  const config = toRecord(configResponse.data)
  const fileLoggingEnabled = readConfigBoolean(config, 'logging-to-file')
  const usageStatisticsEnabled = readConfigBoolean(config, 'usage-statistics-enabled')
  const queryParams = getUsageRecordQueryParams(filters)
  const aggregateQueryParams = getUsageScopeQueryParams(filters)

  const [
    overview,
    records,
    credentialUsage,
    providerHealth,
    credentialHealth,
    realtime,
    requestLogs,
    apiKeyUsage,
    requestErrorLogs,
  ] = await Promise.all([
    capabilities.usageOverview
      ? readOptional(
          issues,
          'usageOverview',
          async () => {
            const response = await client.get<unknown>('/usage/overview', {
              params: aggregateQueryParams,
            })
            return normalizeUsageOverview(response.data)
          },
          null,
        )
      : Promise.resolve(null),
    capabilities.usageRecords
      ? readOptional(
          issues,
          'usageRecords',
          async () => {
            const response = await client.get<unknown>('/usage/records', {
              params: queryParams,
            })
            return normalizeUsageRecordsPage(response.data)
          },
          null,
        )
      : Promise.resolve(null),
    capabilities.usageAggregates
      ? readOptional(
          issues,
          'usageAggregates',
          async () => {
            const response = await client.get<unknown>('/usage/aggregates', {
              params: {
                ...aggregateQueryParams,
                group_by: 'credential',
                metric: 'request_count',
                direction: 'desc',
                limit: 20,
                offset: 0,
              },
            })
            return normalizeAggregateResponse(response.data)
          },
          null,
        )
      : Promise.resolve(null),
    capabilities.usageProviderHealth
      ? readOptional(
          issues,
          'usageProviderHealth',
          async () => {
            const response = await client.get<unknown>('/usage/health/providers', {
              params: aggregateQueryParams,
            })
            return normalizeUsageHealthResponse(response.data, 'provider')
          },
          null,
        )
      : Promise.resolve(null),
    capabilities.usageCredentialHealth
      ? readOptional(
          issues,
          'usageCredentialHealth',
          async () => {
            const response = await client.get<unknown>('/usage/health/credentials', {
              params: aggregateQueryParams,
            })
            return normalizeUsageHealthResponse(response.data, 'credential')
          },
          null,
        )
      : Promise.resolve(null),
    capabilities.usageRealtime
      ? readOptional(
          issues,
          'usageRealtime',
          async () => {
            const response = await client.get<unknown>('/usage/realtime', {
              params: {
                ...aggregateQueryParams,
                window_seconds: 900,
                bucket_seconds: 60,
                group_by: 'model',
              },
            })
            return normalizeUsageRealtimeSnapshot(response.data)
          },
          null,
        )
      : Promise.resolve(null),
    capabilities.requestLogIndex
      ? readOptional(
          issues,
          'requestLogIndex',
          async () => {
            const response = await client.get<unknown>('/request-logs', {
              params: queryParams,
            })
            return normalizeRequestLogIndex(response.data)
          },
          null,
        )
      : Promise.resolve(null),
    capabilities.usage
      ? readOptional(
          issues,
          'apiKeyUsage',
          async () => {
            const response = await client.get<unknown>('/api-key-usage')
            return normalizeApiKeyUsage(response.data)
          },
          [],
        )
      : Promise.resolve([]),
    capabilities.requestErrorLogs
      ? readOptional(
          issues,
          'requestErrorLogs',
          async () => {
            const response = await client.get<unknown>('/request-error-logs')
            return normalizeRequestErrorLogs(response.data)
          },
          [],
        )
      : Promise.resolve([]),
  ])

  return {
    fetchedAt: new Date().toISOString(),
    settings: {
      usageStatisticsEnabled,
      fileLoggingEnabled,
    },
    overview,
    records,
    credentialUsage,
    providerHealth,
    credentialHealth,
    realtime,
    requestLogs,
    apiKeyUsage,
    runtimeLogs: null,
    requestErrorLogs,
    filterOptions: deriveFilterOptions({ overview, records, credentialUsage }),
    issues,
  }
}

export async function fetchUsageOverview(
  session: ManagementSessionInput,
  filters: UsageFilters = defaultUsageFilters,
): Promise<UsageOverview | null> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/usage/overview', {
    params: getUsageScopeQueryParams(filters),
  })

  return normalizeUsageOverview(response.data)
}

export async function fetchUsageAggregates(
  session: ManagementSessionInput,
  filters: UsageFilters = defaultUsageFilters,
  query: UsageAggregatesQuery = defaultUsageAggregatesQuery,
): Promise<UsageAggregateResponse> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/usage/aggregates', {
    params: {
      ...getUsageScopeQueryParams(filters),
      group_by: query.groupBy,
      metric: query.metric,
      direction: query.sortDirection,
      limit: query.limit,
      offset: query.offset,
    },
  })

  return normalizeAggregateResponse(response.data)
}

export async function fetchUsageSnapshot(
  session: ManagementSessionInput,
  capabilities: CapabilityMap,
  filters: UsageFilters,
): Promise<UsageLogsSnapshot> {
  const client = createManagementClient(session)
  const issues: UsageLogIssue[] = []
  const configResponse = await client.get<unknown>('/config')
  const config = toRecord(configResponse.data)
  const fileLoggingEnabled = readConfigBoolean(config, 'logging-to-file')
  const usageStatisticsEnabled = readConfigBoolean(config, 'usage-statistics-enabled')
  const queryParams = getUsageRecordQueryParams(filters)
  const aggregateQueryParams = getUsageScopeQueryParams(filters)

  const [
    overview,
    records,
    credentialUsage,
    providerHealth,
    credentialHealth,
    realtime,
    requestLogs,
  ] = await Promise.all([
    capabilities.usageOverview
      ? readOptional(
          issues,
          'usageOverview',
          async () => {
            const response = await client.get<unknown>('/usage/overview', {
              params: aggregateQueryParams,
            })
            return normalizeUsageOverview(response.data)
          },
          null,
        )
      : Promise.resolve(null),
    capabilities.usageRecords
      ? readOptional(
          issues,
          'usageRecords',
          async () => {
            const response = await client.get<unknown>('/usage/records', {
              params: queryParams,
            })
            return normalizeUsageRecordsPage(response.data)
          },
          null,
        )
      : Promise.resolve(null),
    capabilities.usageAggregates
      ? readOptional(
          issues,
          'usageAggregates',
          async () => {
            const response = await client.get<unknown>('/usage/aggregates', {
              params: {
                ...aggregateQueryParams,
                group_by: 'credential',
                metric: 'request_count',
                direction: 'desc',
                limit: 20,
                offset: 0,
              },
            })
            return normalizeAggregateResponse(response.data)
          },
          null,
        )
      : Promise.resolve(null),
    capabilities.usageProviderHealth
      ? readOptional(
          issues,
          'usageProviderHealth',
          async () => {
            const response = await client.get<unknown>('/usage/health/providers', {
              params: aggregateQueryParams,
            })
            return normalizeUsageHealthResponse(response.data, 'provider')
          },
          null,
        )
      : Promise.resolve(null),
    capabilities.usageCredentialHealth
      ? readOptional(
          issues,
          'usageCredentialHealth',
          async () => {
            const response = await client.get<unknown>('/usage/health/credentials', {
              params: aggregateQueryParams,
            })
            return normalizeUsageHealthResponse(response.data, 'credential')
          },
          null,
        )
      : Promise.resolve(null),
    capabilities.usageRealtime
      ? readOptional(
          issues,
          'usageRealtime',
          async () => {
            const response = await client.get<unknown>('/usage/realtime', {
              params: {
                ...aggregateQueryParams,
                window_seconds: 900,
                bucket_seconds: 60,
                group_by: 'model',
              },
            })
            return normalizeUsageRealtimeSnapshot(response.data)
          },
          null,
        )
      : Promise.resolve(null),
    capabilities.requestLogIndex
      ? readOptional(
          issues,
          'requestLogIndex',
          async () => {
            const response = await client.get<unknown>('/request-logs', {
              params: queryParams,
            })
            return normalizeRequestLogIndex(response.data)
          },
          null,
        )
      : Promise.resolve(null),
  ])

  return {
    fetchedAt: new Date().toISOString(),
    settings: {
      usageStatisticsEnabled,
      fileLoggingEnabled,
    },
    overview,
    records,
    credentialUsage,
    providerHealth,
    credentialHealth,
    realtime,
    requestLogs,
    apiKeyUsage: [],
    runtimeLogs: null,
    requestErrorLogs: [],
    filterOptions: deriveFilterOptions({ overview, records, credentialUsage }),
    issues,
  }
}

export async function fetchUsageRecordDetail(
  session: ManagementSessionInput,
  recordId: string,
): Promise<UsageRecordDetail> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>(`/usage/records/${encodeURIComponent(recordId)}`, {
    params: {
      include_payload: true,
      include_logs: true,
    },
  })
  return normalizeUsageRecordDetail(response.data)
}

export async function fetchRuntimeLogContext(
  session: ManagementSessionInput,
  capabilities: CapabilityMap,
): Promise<RuntimeLogContext> {
  const client = createManagementClient(session)
  const issues: UsageLogIssue[] = []
  const configResponse = await client.get<unknown>('/config')
  const config = toRecord(configResponse.data)
  const fileLoggingEnabled = readConfigBoolean(config, 'logging-to-file')
  const usageStatisticsEnabled = readConfigBoolean(config, 'usage-statistics-enabled')
  const requestErrorLogs = capabilities.requestErrorLogs
    ? await readOptional(
        issues,
        'requestErrorLogs',
        async () => {
          const response = await client.get<unknown>('/request-error-logs')
          return normalizeRequestErrorLogs(response.data)
        },
        [],
      )
    : []

  return {
    fetchedAt: new Date().toISOString(),
    settings: {
      usageStatisticsEnabled,
      fileLoggingEnabled,
    },
    requestErrorLogs,
    issues,
  }
}

export async function exportUsageRecords(
  session: ManagementSessionInput,
  filters: UsageFilters,
  format: 'csv' | 'jsonl',
): Promise<LogDownloadResult> {
  const client = createManagementClient(session)
  const response = await client.get<Blob>('/usage/export', {
    params: {
      ...getUsageRecordQueryParams(filters, false),
      format,
    },
    responseType: 'blob',
  })

  return {
    blob: response.data,
    fileName: getAttachmentFileName(response.headers, `usage-records.${format}`),
  }
}

export async function fetchRuntimeLogs(
  session: ManagementSessionInput,
  query: RuntimeLogQuery,
): Promise<RuntimeLogSnapshot> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/logs', {
    params: getRuntimeLogQueryParams(query),
  })
  return normalizeRuntimeLogs(response.data, query.offset)
}

export async function clearRuntimeLogs(session: ManagementSessionInput): Promise<ClearLogsResult> {
  const client = createManagementClient(session)
  const response = await client.delete<unknown>('/logs')
  const record = toRecord(response.data)

  return {
    success: record.success === true,
    message: readString(record, 'message'),
    removed: readNumber(record, 'removed'),
  }
}

export async function downloadRequestErrorLog(
  session: ManagementSessionInput,
  fileName: string,
): Promise<LogDownloadResult> {
  const client = createManagementClient(session)
  const response = await client.get<Blob>(`/request-error-logs/${encodeURIComponent(fileName)}`, {
    responseType: 'blob',
  })

  return {
    blob: response.data,
    fileName: getAttachmentFileName(response.headers, fileName),
  }
}

export async function downloadRequestLogById(
  session: ManagementSessionInput,
  requestId: string,
  homeIp?: string | null,
  homePort?: number | null,
): Promise<LogDownloadResult> {
  const client = createManagementClient(session)
  const normalizedRequestId = requestId.trim()
  const normalizedHomeIp = homeIp?.trim()
  const normalizedHomePort =
    typeof homePort === 'number' && Number.isFinite(homePort) && homePort > 0
      ? Math.trunc(homePort)
      : null
  const params =
    normalizedHomeIp || normalizedHomePort
      ? {
          ...(normalizedHomeIp ? { home_ip: normalizedHomeIp } : {}),
          ...(normalizedHomePort ? { home_port: normalizedHomePort } : {}),
        }
      : undefined
  const response = await client.get<Blob>(
    `/request-log-by-id/${encodeURIComponent(normalizedRequestId)}`,
    {
      params,
      responseType: 'blob',
    },
  )

  return {
    blob: response.data,
    fileName: getAttachmentFileName(response.headers, `request-${normalizedRequestId}.log`),
  }
}

export function toUsageLogsApiError(error: unknown) {
  const apiError = toManagementApiError(error)
  const usageError = new Error(apiError.message, { cause: error }) as UsageLogsApiError
  usageError.status = apiError.status
  usageError.code = apiError.code
  return usageError
}
