import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { CapabilityMap, ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type UsageLogIssueScope =
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
  homeIp: string | null
  model: string | null
  endpoint: string | null
  failed: boolean | null
  raw: unknown
}

export type RuntimeLogRecord = {
  id: string
  timestamp: string | null
  clientIp: string | null
  requestId: string | null
  homeIp: string | null
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

export type RuntimeLogQuery = {
  limit: number
  offset: number
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

export type UsageLogsSnapshot = {
  fetchedAt: string
  settings: UsageRuntimeSettings
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

function readNumber(record: UnknownRecord, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readBoolean(record: UnknownRecord, key: string): boolean | null {
  const value = record[key]
  return typeof value === 'boolean' ? value : null
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
      homeIp: readString(recordValue, 'home_ip') ?? readString(recordValue, 'home-ip'),
      model: readString(recordValue, 'model'),
      endpoint: readString(recordValue, 'endpoint') ?? readString(recordValue, 'path'),
      failed: readBoolean(recordValue, 'failed'),
      raw: record,
    }
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

  return {
    id: idValue !== null ? String(idValue) : `runtime-log-${index + 1}`,
    timestamp,
    clientIp: readString(recordValue, 'client_ip') ?? readString(recordValue, 'client-ip'),
    requestId,
    homeIp,
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
  options?: {
    runtimeLogs?: RuntimeLogQuery
  },
): Promise<UsageLogsSnapshot> {
  const client = createManagementClient(session)
  const issues: UsageLogIssue[] = []
  const runtimeLogQuery = options?.runtimeLogs ?? { limit: 50, offset: 0 }
  const configResponse = await client.get<unknown>('/config')
  const config = toRecord(configResponse.data)
  const fileLoggingEnabled = readConfigBoolean(config, 'logging-to-file')
  const usageStatisticsEnabled = readConfigBoolean(config, 'usage-statistics-enabled')

  const [apiKeyUsage, runtimeLogs, requestErrorLogs] = await Promise.all([
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
    capabilities.logs
      ? readOptional(
          issues,
          'logs',
          async () => {
            const response = await client.get<unknown>('/logs', {
              params: runtimeLogQuery,
            })
            return normalizeRuntimeLogs(response.data, runtimeLogQuery.offset)
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

  return {
    fetchedAt: new Date().toISOString(),
    settings: {
      usageStatisticsEnabled,
      fileLoggingEnabled,
    },
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
): Promise<LogDownloadResult> {
  const client = createManagementClient(session)
  const normalizedRequestId = requestId.trim()
  const normalizedHomeIp = homeIp?.trim()
  if (!normalizedHomeIp) {
    throw new Error('home_ip is required to download a request log')
  }

  const response = await client.get<Blob>(
    `/request-log-by-id/${encodeURIComponent(normalizedRequestId)}`,
    {
      params: { home_ip: normalizedHomeIp },
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
