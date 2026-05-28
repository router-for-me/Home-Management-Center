import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { CapabilityMap, ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type UsageLogIssueScope =
  | 'usageAnalytics'
  | 'usageAnalyticsOptions'
  | 'apiKeyUsage'
  | 'usageQueue'
  | 'logs'
  | 'requestErrorLogs'
  | 'clearLogs'

export type UsageLogIssue = {
  scope: UsageLogIssueScope
  message: string
  status?: number
  code?: string
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

export type UsageQueueRecord = {
  id: string
  requestId: string | null
  model: string | null
  endpoint: string | null
  failed: boolean | null
  raw: unknown
}

export type RuntimeLogSnapshot = {
  lines: string[]
  lineCount: number
  latestTimestamp: number | null
}

export type RequestErrorLogFile = {
  name: string
  size: number | null
  modified: number | null
}

export type UsageRuntimeSettings = {
  usageStatisticsEnabled: boolean
  fileLoggingEnabled: boolean
}

export type UsageAnalyticsFilters = {
  scope?: 'admin' | 'account'
  start?: string
  end?: string
  userId?: number
  apiKeyDescription?: string
  provider?: string
  model?: string
  sourceKey?: string
  endpoint?: string
  failed?: boolean
  requestId?: string
}

export type UsageAnalyticsRecordsQuery = UsageAnalyticsFilters & {
  page?: number
  pageSize?: number
}

export type UsageAnalyticsOptionItem = {
  value: string
  label: string
  description: string | null
}

export type UsageAnalyticsOptions = {
  users: UsageAnalyticsOptionItem[]
  clientKeys: UsageAnalyticsOptionItem[]
  providers: UsageAnalyticsOptionItem[]
  models: UsageAnalyticsOptionItem[]
  credentials: UsageAnalyticsOptionItem[]
  endpoints: UsageAnalyticsOptionItem[]
}

export type UsageAnalyticsSummary = {
  start: string | null
  end: string | null
  totalRecords: number
  failedRecords: number
  successRecords: number
  successRate: number
  failureRate: number
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  reasoningTokens: number
  totalTokens: number
  estimatedCostUsd: number
  unpricedRecords: number
  rpm: number | null
  tpm: number | null
}

export type UsageTrendPoint = {
  bucket: string
  records: number
  failedRecords: number
  successRecords: number
  totalTokens: number
  estimatedCostUsd: number
}

export type UsageRankingItem = {
  key: string
  label: string
  records: number
  failedRecords: number
  successRecords: number
  totalTokens: number
  estimatedCostUsd: number
  userId: number | null
  apiKeyDescription: string | null
}

export type UsageDistributionItem = {
  key: string
  label: string
  records: number
  failedRecords: number
  totalTokens: number
  estimatedCostUsd: number
}

export type UsageDistributions = {
  providers: UsageDistributionItem[]
  models: UsageDistributionItem[]
  endpoints: UsageDistributionItem[]
  errors: UsageDistributionItem[]
}

export type UsageAnalyticsOverview = {
  summary: UsageAnalyticsSummary
  trends: UsageTrendPoint[]
  userRanking: UsageRankingItem[]
  clientKeyRanking: UsageRankingItem[]
  modelRanking: UsageRankingItem[]
  distributions: UsageDistributions
}

export type UsageRequestRecord = {
  id: string
  requestId: string | null
  timestamp: string | null
  userId: number | null
  userLabel: string | null
  apiKeyDescription: string | null
  provider: string | null
  model: string | null
  endpoint: string | null
  failed: boolean | null
  status: string | null
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  reasoningTokens: number
  totalTokens: number
  estimatedCostUsd: number
  latencyMs: number | null
  firstTokenLatencyMs: number | null
  sourceKey: string | null
  errorMessage: string | null
  raw: unknown
}

export type UsageRequestRecordsPage = {
  records: UsageRequestRecord[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
}

export type UsageRequestRecordDetail = {
  record: UsageRequestRecord
  raw: unknown
}

type UsageLogsSnapshot = {
  fetchedAt: string
  settings: UsageRuntimeSettings
  analyticsOverview: UsageAnalyticsOverview | null
  analyticsOptions: UsageAnalyticsOptions | null
  apiKeyUsage: ApiKeyUsageResource[]
  runtimeLogs: RuntimeLogSnapshot | null
  requestErrorLogs: RequestErrorLogFile[]
  issues: UsageLogIssue[]
}

type ClearLogsResult = {
  success: boolean
  message: string | null
  removed: number | null
}

type LogDownloadResult = {
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

function readStringLike(record: UnknownRecord, key: string): string | null {
  const value = record[key]
  if (typeof value === 'string') return value.trim() ? value : null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function readNumber(record: UnknownRecord, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readInteger(record: UnknownRecord, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function readNumberFromKeys(record: UnknownRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = readNumber(record, key)
    if (value !== null) return value
  }
  return null
}

function readIntegerFromKeys(record: UnknownRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = readInteger(record, key)
    if (value !== null) return value
  }
  return null
}

function readStringFromKeys(record: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = readString(record, key)
    if (value !== null) return value
  }
  return null
}

function readStringLikeFromKeys(record: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = readStringLike(record, key)
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

function normalizeUsageQueue(responseData: unknown): UsageQueueRecord[] {
  const records: unknown[] = Array.isArray(responseData) ? responseData : []

  return records.map((record, index) => {
    const recordValue = toRecord(record)
    const requestId = readString(recordValue, 'request_id') ?? readString(recordValue, 'id')

    return {
      id: requestId ?? `usage-record-${index + 1}`,
      requestId,
      model: readString(recordValue, 'model'),
      endpoint: readString(recordValue, 'endpoint') ?? readString(recordValue, 'path'),
      failed: readBoolean(recordValue, 'failed'),
      raw: record,
    }
  })
}

function normalizeRuntimeLogs(responseData: unknown): RuntimeLogSnapshot {
  const record = toRecord(responseData)
  const lines = record.lines

  return {
    lines: Array.isArray(lines)
      ? lines.filter((line): line is string => typeof line === 'string')
      : [],
    lineCount: readNumber(record, 'line-count') ?? 0,
    latestTimestamp: readNumber(record, 'latest-timestamp'),
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

function normalizeUsageSummary(responseData: unknown): UsageAnalyticsSummary {
  const record = toRecord(responseData)
  const totalRecords = readNumberFromKeys(record, ['total_records', 'requests', 'records']) ?? 0
  const failedRecords = readNumberFromKeys(record, ['failed_records', 'failed']) ?? 0
  const successRecords =
    readNumberFromKeys(record, ['success_records', 'success']) ??
    Math.max(totalRecords - failedRecords, 0)
  const totalTokens = readNumberFromKeys(record, ['total_tokens', 'tokens']) ?? 0
  const explicitFailureRate = readNumberFromKeys(record, ['failure_rate', 'failureRate'])
  const explicitSuccessRate = readNumberFromKeys(record, ['success_rate', 'successRate'])
  const failureRate =
    explicitFailureRate ?? (totalRecords > 0 ? (failedRecords / totalRecords) * 100 : 0)

  return {
    start: readString(record, 'start'),
    end: readString(record, 'end'),
    totalRecords,
    failedRecords,
    successRecords,
    successRate:
      explicitSuccessRate ?? (totalRecords > 0 ? (successRecords / totalRecords) * 100 : 0),
    failureRate,
    inputTokens: readNumberFromKeys(record, ['input_tokens', 'prompt_tokens']) ?? 0,
    outputTokens: readNumberFromKeys(record, ['output_tokens', 'completion_tokens']) ?? 0,
    cachedTokens: readNumberFromKeys(record, ['cached_tokens', 'cache_tokens']) ?? 0,
    cacheReadTokens: readNumber(record, 'cache_read_tokens') ?? 0,
    cacheCreationTokens:
      readNumberFromKeys(record, ['cache_creation_tokens', 'cache_write_tokens']) ?? 0,
    reasoningTokens: readNumber(record, 'reasoning_tokens') ?? 0,
    totalTokens,
    estimatedCostUsd: readNumberFromKeys(record, ['estimated_cost_usd', 'cost_usd', 'cost']) ?? 0,
    unpricedRecords: readNumberFromKeys(record, ['unpriced_records', 'unpriced_requests']) ?? 0,
    rpm: readNumberFromKeys(record, ['rpm', 'avg_rpm', 'requests_per_minute']),
    tpm: readNumberFromKeys(record, ['tpm', 'avg_tpm', 'tokens_per_minute']),
  }
}

function normalizeUsageTrendPoint(responseData: unknown, index: number): UsageTrendPoint {
  const record = toRecord(responseData)
  const records = readNumberFromKeys(record, ['records', 'total_records', 'requests']) ?? 0
  const failedRecords = readNumberFromKeys(record, ['failed_records', 'failed']) ?? 0

  return {
    bucket:
      readStringFromKeys(record, ['bucket', 'timestamp', 'time']) ?? `usage-bucket-${index + 1}`,
    records,
    failedRecords,
    successRecords:
      readNumberFromKeys(record, ['success_records', 'success']) ??
      Math.max(records - failedRecords, 0),
    totalTokens: readNumberFromKeys(record, ['total_tokens', 'tokens']) ?? 0,
    estimatedCostUsd: readNumberFromKeys(record, ['estimated_cost_usd', 'cost_usd', 'cost']) ?? 0,
  }
}

function normalizeUsageRankingItem(responseData: unknown, index: number): UsageRankingItem {
  const record = toRecord(responseData)
  const key = readString(record, 'key') ?? readString(record, 'label') ?? `ranking-${index + 1}`
  const records = readNumberFromKeys(record, ['records', 'total_records', 'requests']) ?? 0
  const failedRecords = readNumberFromKeys(record, ['failed_records', 'failed']) ?? 0

  return {
    key,
    label: readString(record, 'label') ?? key,
    records,
    failedRecords,
    successRecords:
      readNumberFromKeys(record, ['success_records', 'success']) ??
      Math.max(records - failedRecords, 0),
    totalTokens: readNumberFromKeys(record, ['total_tokens', 'tokens']) ?? 0,
    estimatedCostUsd: readNumberFromKeys(record, ['estimated_cost_usd', 'cost_usd', 'cost']) ?? 0,
    userId: readNumber(record, 'user_id'),
    apiKeyDescription: readString(record, 'api_key_description'),
  }
}

function normalizeUsageDistributionItem(
  responseData: unknown,
  index: number,
): UsageDistributionItem {
  const record = toRecord(responseData)
  const key =
    readString(record, 'key') ?? readString(record, 'label') ?? `distribution-${index + 1}`
  const records = readNumberFromKeys(record, ['records', 'total_records', 'requests']) ?? 0

  return {
    key,
    label: readString(record, 'label') ?? key,
    records,
    failedRecords: readNumberFromKeys(record, ['failed_records', 'failed']) ?? 0,
    totalTokens: readNumberFromKeys(record, ['total_tokens', 'tokens']) ?? 0,
    estimatedCostUsd: readNumberFromKeys(record, ['estimated_cost_usd', 'cost_usd', 'cost']) ?? 0,
  }
}

function normalizeArray<T>(value: unknown, normalize: (item: unknown, index: number) => T): T[] {
  return Array.isArray(value) ? value.map(normalize) : []
}

function normalizeUsageOptionItem(responseData: unknown, index: number): UsageAnalyticsOptionItem {
  if (typeof responseData === 'string' && responseData.trim()) {
    return {
      value: responseData,
      label: responseData,
      description: null,
    }
  }

  if (typeof responseData === 'number' && Number.isFinite(responseData)) {
    return {
      value: String(responseData),
      label: String(responseData),
      description: null,
    }
  }

  const record = toRecord(responseData)
  const value =
    readStringLikeFromKeys(record, [
      'value',
      'key',
      'id',
      'user_id',
      'api_key_description',
      'provider',
      'model',
      'source_key',
      'endpoint',
      'name',
      'label',
    ]) ?? `option-${index + 1}`

  return {
    value,
    label:
      readStringLikeFromKeys(record, [
        'label',
        'name',
        'username',
        'display_name',
        'description',
        'api_key_description',
        'provider',
        'model',
        'endpoint',
        'value',
      ]) ?? value,
    description: readStringFromKeys(record, ['description', 'email', 'provider', 'type']),
  }
}

function normalizeUsageOptionList(value: unknown): UsageAnalyticsOptionItem[] {
  const seen = new Set<string>()

  return normalizeArray(value, normalizeUsageOptionItem).filter((item) => {
    const normalizedValue = item.value.trim()
    if (!normalizedValue || seen.has(normalizedValue)) return false
    seen.add(normalizedValue)
    return true
  })
}

function hasOptionPayload(value: unknown) {
  return isRecord(value) && Object.keys(value).length > 0
}

function normalizeUsageAnalyticsOptions(responseData: unknown): UsageAnalyticsOptions {
  const root = toRecord(responseData)
  const options = hasOptionPayload(root.options) ? toRecord(root.options) : root

  return {
    users: normalizeUsageOptionList(options.users),
    clientKeys: normalizeUsageOptionList(
      options.client_keys ?? options.clientKeys ?? options.api_key_descriptions ?? options.api_keys,
    ),
    providers: normalizeUsageOptionList(options.providers),
    models: normalizeUsageOptionList(options.models),
    credentials: normalizeUsageOptionList(
      options.credentials ?? options.sources ?? options.source_keys ?? options.auth_files,
    ),
    endpoints: normalizeUsageOptionList(options.endpoints ?? options.request_types),
  }
}

function normalizeUsageDistributions(responseData: unknown): UsageDistributions {
  const record = toRecord(responseData)

  return {
    providers: normalizeArray(
      record.providers ?? record.provider_distribution ?? record.providerDistribution,
      normalizeUsageDistributionItem,
    ),
    models: normalizeArray(
      record.models ?? record.model_distribution ?? record.modelDistribution,
      normalizeUsageDistributionItem,
    ),
    endpoints: normalizeArray(
      record.endpoints ??
        record.endpoint_distribution ??
        record.endpointDistribution ??
        record.request_types,
      normalizeUsageDistributionItem,
    ),
    errors: normalizeArray(
      record.errors ?? record.error_distribution ?? record.errorDistribution,
      normalizeUsageDistributionItem,
    ),
  }
}

function normalizeUsageRankingList(value: unknown): UsageRankingItem[] {
  if (Array.isArray(value)) return normalizeArray(value, normalizeUsageRankingItem)

  const record = toRecord(value)
  return normalizeArray(
    record.items ?? record.records ?? record.data ?? record.rankings,
    normalizeUsageRankingItem,
  )
}

function normalizeUsageAnalyticsOverview(responseData: unknown): UsageAnalyticsOverview {
  const record = toRecord(responseData)
  const rankings = toRecord(record.rankings)
  const apiKeyRanking =
    record.api_key_description_ranking ??
    record.api_key_ranking ??
    record.client_key_ranking ??
    rankings.client_keys ??
    rankings.clientKeys
  const userRanking = record.user_ranking ?? rankings.users
  const modelRanking = record.model_ranking ?? rankings.models

  return {
    summary: normalizeUsageSummary(record.summary),
    trends: normalizeArray(record.trends, normalizeUsageTrendPoint),
    userRanking: normalizeUsageRankingList(userRanking),
    clientKeyRanking: normalizeUsageRankingList(apiKeyRanking),
    modelRanking: normalizeUsageRankingList(modelRanking),
    distributions: normalizeUsageDistributions(record.distributions),
  }
}

function normalizeUsageAnalyticsOverviewBundle(responseData: unknown) {
  const record = toRecord(responseData)

  return {
    overview: normalizeUsageAnalyticsOverview(record),
    options: hasOptionPayload(record.options)
      ? normalizeUsageAnalyticsOptions(record.options)
      : null,
  }
}

function analyticsFiltersToParams(filters: UsageAnalyticsFilters | undefined) {
  if (!filters) return undefined

  return {
    scope: filters.scope,
    start: filters.start,
    end: filters.end,
    user_id: filters.userId,
    api_key_description: filters.apiKeyDescription,
    provider: filters.provider,
    model: filters.model,
    source_key: filters.sourceKey,
    endpoint: filters.endpoint,
    failed: filters.failed,
    request_id: filters.requestId,
  }
}

function usageRecordsQueryToParams(query: UsageAnalyticsRecordsQuery | undefined) {
  return {
    ...analyticsFiltersToParams(query),
    page: query?.page,
    page_size: query?.pageSize,
  }
}

function readUsageRequestRecordItems(responseData: unknown): unknown[] {
  if (Array.isArray(responseData)) return responseData

  const record = toRecord(responseData)
  const items = record.records ?? record.items ?? record.data ?? record.requests

  return Array.isArray(items) ? items : []
}

function normalizeUsageRequestRecord(responseData: unknown, index = 0): UsageRequestRecord {
  const record = toRecord(responseData)
  const requestId = readStringLikeFromKeys(record, ['request_id', 'requestId', 'request', 'id'])
  const id =
    readStringLikeFromKeys(record, ['id', 'record_id', 'recordId', 'request_id', 'requestId']) ??
    `usage-request-${index + 1}`
  const failed = readBooleanFromKeys(record, ['failed', 'is_failed', 'error'])
  const success = readBooleanFromKeys(record, ['success', 'succeeded'])
  const inputTokens = readNumberFromKeys(record, ['input_tokens', 'prompt_tokens']) ?? 0
  const outputTokens = readNumberFromKeys(record, ['output_tokens', 'completion_tokens']) ?? 0
  const cachedTokens = readNumberFromKeys(record, ['cached_tokens', 'cache_tokens']) ?? 0
  const cacheReadTokens = readNumber(record, 'cache_read_tokens') ?? 0
  const cacheCreationTokens =
    readNumberFromKeys(record, ['cache_creation_tokens', 'cache_write_tokens']) ?? 0
  const reasoningTokens = readNumber(record, 'reasoning_tokens') ?? 0
  const explicitTotalTokens = readNumberFromKeys(record, ['total_tokens', 'tokens'])

  return {
    id,
    requestId,
    timestamp: readStringFromKeys(record, [
      'timestamp',
      'time',
      'created_at',
      'createdAt',
      'request_time',
      'requestTime',
    ]),
    userId: readIntegerFromKeys(record, ['user_id', 'userId', 'uid']),
    userLabel: readStringLikeFromKeys(record, [
      'user_label',
      'userLabel',
      'username',
      'user_name',
      'user',
    ]),
    apiKeyDescription: readStringLikeFromKeys(record, [
      'api_key_description',
      'apiKeyDescription',
      'client_key',
      'clientKey',
      'key_description',
    ]),
    provider: readStringLikeFromKeys(record, ['provider', 'service_provider']),
    model: readStringLikeFromKeys(record, ['model', 'model_name']),
    endpoint: readStringLikeFromKeys(record, ['endpoint', 'request_type', 'path', 'route']),
    failed: failed ?? (success !== null ? !success : null),
    status: readStringLikeFromKeys(record, ['status', 'status_text', 'error_type']),
    inputTokens,
    outputTokens,
    cachedTokens,
    cacheReadTokens,
    cacheCreationTokens,
    reasoningTokens,
    totalTokens:
      explicitTotalTokens ??
      inputTokens +
        outputTokens +
        cachedTokens +
        cacheReadTokens +
        cacheCreationTokens +
        reasoningTokens,
    estimatedCostUsd: readNumberFromKeys(record, ['estimated_cost_usd', 'cost_usd', 'cost']) ?? 0,
    latencyMs: readNumberFromKeys(record, ['latency_ms', 'duration_ms', 'duration', 'elapsed_ms']),
    firstTokenLatencyMs: readNumberFromKeys(record, [
      'first_token_latency_ms',
      'firstTokenLatencyMs',
      'first_token_ms',
    ]),
    sourceKey: readStringLikeFromKeys(record, ['source_key', 'sourceKey', 'credential', 'source']),
    errorMessage: readStringLikeFromKeys(record, ['error_message', 'errorMessage', 'error']),
    raw: responseData,
  }
}

function normalizeUsageRequestRecordsPage(
  responseData: unknown,
  query: UsageAnalyticsRecordsQuery | undefined,
): UsageRequestRecordsPage {
  const record = toRecord(responseData)
  const requestedPage = Math.max(query?.page ?? 1, 1)
  const requestedPageSize = Math.max(query?.pageSize ?? 20, 1)
  const records = readUsageRequestRecordItems(responseData).map(normalizeUsageRequestRecord)
  const page = readIntegerFromKeys(record, ['page', 'current_page', 'currentPage']) ?? requestedPage
  const pageSize =
    readIntegerFromKeys(record, ['page_size', 'pageSize', 'limit', 'per_page']) ?? requestedPageSize
  const total =
    readIntegerFromKeys(record, ['total', 'total_records', 'totalRecords', 'count']) ??
    records.length
  const totalPages =
    readIntegerFromKeys(record, ['total_pages', 'totalPages', 'pages']) ??
    Math.max(Math.ceil(total / pageSize), 1)
  const hasNextPage =
    readBooleanFromKeys(record, ['has_next_page', 'hasNextPage', 'has_next']) ?? page < totalPages

  return {
    records,
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage,
  }
}

function normalizeUsageRequestRecordDetail(responseData: unknown): UsageRequestRecordDetail {
  const record = toRecord(responseData)
  const recordPayload = record.record ?? record.detail ?? record.data ?? responseData

  return {
    record: normalizeUsageRequestRecord(recordPayload),
    raw: responseData,
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
  analyticsFilters?: UsageAnalyticsFilters,
): Promise<UsageLogsSnapshot> {
  const client = createManagementClient(session)
  const issues: UsageLogIssue[] = []
  const configResponse = await client.get<unknown>('/config')
  const config = toRecord(configResponse.data)
  const fileLoggingEnabled = readConfigBoolean(config, 'logging-to-file')
  const usageStatisticsEnabled = readConfigBoolean(config, 'usage-statistics-enabled')

  const [analyticsBundle, apiKeyUsage, runtimeLogs, requestErrorLogs] = await Promise.all([
    capabilities.usageAnalytics
      ? readOptional(
          issues,
          'usageAnalytics',
          async () => {
            const response = await client.get<unknown>('/usage/overview', {
              params: analyticsFiltersToParams(analyticsFilters),
            })
            return normalizeUsageAnalyticsOverviewBundle(response.data)
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
    capabilities.logs && fileLoggingEnabled
      ? readOptional(
          issues,
          'logs',
          async () => {
            const response = await client.get<unknown>('/logs', {
              params: { limit: 80 },
            })
            return normalizeRuntimeLogs(response.data)
          },
          null,
        )
      : Promise.resolve(null),
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
  const analyticsOptions =
    analyticsBundle?.options ??
    (capabilities.usageAnalytics && analyticsBundle
      ? await readOptional(
          issues,
          'usageAnalyticsOptions',
          async () => {
            const response = await client.get<unknown>('/usage/options')
            return normalizeUsageAnalyticsOptions(response.data)
          },
          null,
        )
      : null)

  return {
    fetchedAt: new Date().toISOString(),
    settings: {
      usageStatisticsEnabled,
      fileLoggingEnabled,
    },
    analyticsOverview: analyticsBundle?.overview ?? null,
    analyticsOptions,
    apiKeyUsage,
    runtimeLogs,
    requestErrorLogs,
    issues,
  }
}

export async function fetchUsageQueueRecords(
  session: ManagementSessionInput,
  count = 20,
): Promise<UsageQueueRecord[]> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/usage-queue', {
    params: { count },
  })

  return normalizeUsageQueue(response.data)
}

export async function fetchUsageRequestRecords(
  session: ManagementSessionInput,
  query?: UsageAnalyticsRecordsQuery,
): Promise<UsageRequestRecordsPage> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/usage/records', {
    params: usageRecordsQueryToParams(query),
  })

  return normalizeUsageRequestRecordsPage(response.data, query)
}

export async function fetchUsageRequestRecordDetail(
  session: ManagementSessionInput,
  recordId: string,
): Promise<UsageRequestRecordDetail> {
  const client = createManagementClient(session)
  const normalizedRecordId = recordId.trim()
  const response = await client.get<unknown>(
    `/usage/records/${encodeURIComponent(normalizedRecordId)}`,
  )

  return normalizeUsageRequestRecordDetail(response.data)
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
): Promise<LogDownloadResult> {
  const client = createManagementClient(session)
  const normalizedRequestId = requestId.trim()
  const response = await client.get<Blob>(
    `/request-log-by-id/${encodeURIComponent(normalizedRequestId)}`,
    {
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
  return new Error(apiError.message, { cause: error })
}
