import type { AxiosResponse } from 'axios'

import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { CapabilityMap, ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type SystemNodeResource = {
  id: string
  ip: string
  nodeId: string | null
  connectedTime: string | null
  clientCount: number | null
  healthy: boolean | null
  pluginReportState: SystemPluginReportState
  pluginReportStatuses: SystemPluginReportStatus[]
}

export type SystemPluginReportState =
  | 'not_required'
  | 'missing_report'
  | 'reported_partial'
  | 'reported_failed'
  | 'reported_ok'
  | 'unknown'

export type SystemPluginReportPlugin = {
  id: string
  installStatus: string | null
  loadStatus: string | null
  deleteStatus: string | null
  fields: Record<string, string>
}

export type SystemPluginReportStatus = {
  schemaVersion: number | null
  task: string | null
  nodeType: string | null
  nodeId: string | null
  clientIp: string | null
  status: string | null
  phase: string | null
  ok: boolean | null
  updatedAt: string | null
  platform: {
    goos: string | null
    goarch: string | null
  }
  plugins: SystemPluginReportPlugin[]
}

export type SystemConfigSummary = {
  debug: boolean
  requestLog: boolean
  usageStatistics: boolean
  loggingToFile: boolean
  routingStrategy: string
  proxyConfigured: boolean
}

export type SystemIssueScope = 'latestVersion' | 'config' | 'nodes' | 'apiCall'

export type SystemIssue = {
  scope: SystemIssueScope
  message: string
  status?: number
  code?: string
}

export type SystemNodesSnapshot = {
  fetchedAt: string
  homeVersion: string | null
  latestVersion: string | null
  config: SystemConfigSummary | null
  pluginReportRequired: boolean
  pluginReportStatuses: SystemPluginReportStatus[]
  nodes: SystemNodeResource[]
  issues: SystemIssue[]
}

export type SystemNodePluginReportSnapshot = {
  fetchedAt: string
  pluginReportRequired: boolean
  pluginReportStatuses: SystemPluginReportStatus[]
  nodes: SystemNodeResource[]
}

export type ApiCallInput = {
  method: string
  url: string
  authIndex: string
  headers: string
  data: string
}

export type ApiCallResult = {
  statusCode: number | null
  headers: Record<string, string[]>
  body: string
}

export type CertificateClientEnrollment = {
  id: string
  homeJwt: string
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

function readResponseHeader(response: AxiosResponse, name: string): string | null {
  const headers = response.headers as Record<string, unknown>
  const value = headers[name.toLowerCase()]
  if (Array.isArray(value)) {
    const firstValue = value[0] as unknown
    return typeof firstValue === 'string' && firstValue.trim() ? firstValue : null
  }
  if (typeof value === 'string' && value.trim()) return value
  return null
}

function readRoutingStrategy(record: UnknownRecord): string {
  const strategy = readString(record, 'strategy')

  return strategy && strategy.toLowerCase() !== 'unknown' ? strategy : 'unknown'
}

function readBoolean(record: UnknownRecord, key: string): boolean {
  return record[key] === true
}

function readOptionalBoolean(record: UnknownRecord, key: string): boolean | null {
  const value = record[key]
  return typeof value === 'boolean' ? value : null
}

function readArrayRecords(value: unknown, key: string): UnknownRecord[] {
  const records = toRecord(value)[key]
  return Array.isArray(records) ? records.filter(isRecord) : []
}

function normalizeIssue(scope: SystemIssueScope, error: unknown): SystemIssue {
  const apiError = toManagementApiError(error)

  return {
    scope,
    message: apiError.message,
    status: apiError.status,
    code: apiError.code,
  }
}

async function readOptional<T>(
  issues: SystemIssue[],
  scope: SystemIssueScope,
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

function normalizeConfigSummary(responseData: unknown): SystemConfigSummary {
  const config = toRecord(responseData)
  const routing = toRecord(config.routing)

  return {
    debug: readBoolean(config, 'debug'),
    requestLog: readBoolean(config, 'request-log'),
    usageStatistics: readBoolean(config, 'usage-statistics-enabled'),
    loggingToFile: readBoolean(config, 'logging-to-file'),
    routingStrategy: readRoutingStrategy(routing),
    proxyConfigured: Boolean(readString(config, 'proxy-url')),
  }
}

function normalizePluginReportState(value: string | null): SystemPluginReportState {
  if (
    value === 'not_required' ||
    value === 'missing_report' ||
    value === 'reported_partial' ||
    value === 'reported_failed' ||
    value === 'reported_ok'
  ) {
    return value
  }
  return 'unknown'
}

function normalizePluginReportPlugin(value: unknown): SystemPluginReportPlugin | null {
  const record = toRecord(value)
  const id = readString(record, 'id')
  if (!id) return null

  const fields = Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => key !== 'id')
      .flatMap(([key, fieldValue]) => {
        if (typeof fieldValue === 'string' && fieldValue.trim()) {
          return [[key, fieldValue.trim()]]
        }
        if (typeof fieldValue === 'number' || typeof fieldValue === 'boolean') {
          return [[key, String(fieldValue)]]
        }
        return []
      }),
  )

  return {
    id,
    installStatus: readString(record, 'install_status'),
    loadStatus: readString(record, 'load_status'),
    deleteStatus: readString(record, 'delete_status'),
    fields,
  }
}

function normalizePluginReportStatus(value: unknown): SystemPluginReportStatus | null {
  const record = toRecord(value)
  const platform = toRecord(record.platform)
  const plugins = Array.isArray(record.plugins)
    ? record.plugins.flatMap((item) => {
        const plugin = normalizePluginReportPlugin(item)
        return plugin ? [plugin] : []
      })
    : []
  const nodeId = readString(record, 'node_id')
  const clientIp = readString(record, 'client_ip')
  const status = readString(record, 'status')
  const phase = readString(record, 'phase')

  if (!nodeId && !clientIp && !status && !phase && plugins.length === 0) return null

  return {
    schemaVersion: readNumber(record, 'schema_version'),
    task: readString(record, 'task'),
    nodeType: readString(record, 'node_type'),
    nodeId,
    clientIp,
    status,
    phase,
    ok: readOptionalBoolean(record, 'ok'),
    updatedAt: readString(record, 'updated_at'),
    platform: {
      goos: readString(platform, 'goos'),
      goarch: readString(platform, 'goarch'),
    },
    plugins,
  }
}

function normalizePluginReportStatuses(value: unknown): SystemPluginReportStatus[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const status = normalizePluginReportStatus(item)
        return status ? [status] : []
      })
    : []
}

function normalizeNodes(responseData: unknown): SystemNodeResource[] {
  return readArrayRecords(responseData, 'nodes').map((record, index) => {
    const ip = readString(record, 'ip') ?? `node-${index + 1}`
    const nodeId = readString(record, 'node_id')

    return {
      id: nodeId ?? ip,
      ip,
      nodeId,
      connectedTime: readString(record, 'connected_time'),
      clientCount: readNumber(record, 'client_count'),
      healthy: readOptionalBoolean(record, 'healthy'),
      pluginReportState: normalizePluginReportState(readString(record, 'plugin_report_state')),
      pluginReportStatuses: normalizePluginReportStatuses(record.plugin_report_statuses),
    }
  })
}

function normalizeHeaders(value: unknown): Record<string, string[]> {
  const headers = toRecord(value)

  return Object.fromEntries(
    Object.entries(headers).map(([key, headerValue]) => [
      key,
      Array.isArray(headerValue)
        ? headerValue.filter((item): item is string => typeof item === 'string')
        : typeof headerValue === 'string'
          ? [headerValue]
          : [],
    ]),
  )
}

function parseHeaderInput(value: string): Record<string, string> {
  const trimmed = value.trim()
  if (!trimmed) return {}

  const parsed = JSON.parse(trimmed) as unknown
  const record = toRecord(parsed)

  return Object.fromEntries(
    Object.entries(record)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, headerValue]) => [key, headerValue]),
  )
}

export async function fetchSystemNodesSnapshot(
  session: ManagementSessionInput,
  capabilities: CapabilityMap,
): Promise<SystemNodesSnapshot> {
  const client = createManagementClient(session)
  const issues: SystemIssue[] = []

  let homeVersion: string | null = null
  let latestVersion: string | null = null

  const [, config, nodesResponseData] = await Promise.all([
    readOptional(
      issues,
      'latestVersion',
      async () => {
        const response = await client.get<unknown>('/latest-version')
        homeVersion = readResponseHeader(response, 'x-cpa-home-version')
        latestVersion = readString(toRecord(response.data), 'latest-version')
        return true
      },
      false,
    ),
    readOptional(
      issues,
      'config',
      async () => {
        const response = await client.get<unknown>('/config')
        return normalizeConfigSummary(response.data)
      },
      null,
    ),
    capabilities.nodes
      ? readOptional(
          issues,
          'nodes',
          async () => {
            const response = await client.get<unknown>('/nodes')
            return toRecord(response.data)
          },
          {},
        )
      : Promise.resolve({}),
  ])
  const nodesData = toRecord(nodesResponseData)
  const nodes = normalizeNodes(nodesData)

  return {
    fetchedAt: new Date().toISOString(),
    homeVersion,
    latestVersion,
    config,
    pluginReportRequired: readBoolean(nodesData, 'plugin_report_required'),
    pluginReportStatuses: normalizePluginReportStatuses(nodesData.plugin_report_statuses),
    nodes,
    issues,
  }
}

export async function fetchSystemNodePluginReports(
  session: ManagementSessionInput,
): Promise<SystemNodePluginReportSnapshot> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/nodes')
  const responseData = toRecord(response.data)

  return {
    fetchedAt: new Date().toISOString(),
    pluginReportRequired: readBoolean(responseData, 'plugin_report_required'),
    pluginReportStatuses: normalizePluginReportStatuses(responseData.plugin_report_statuses),
    nodes: normalizeNodes(responseData),
  }
}

export async function createCertificateClient(
  session: ManagementSessionInput,
): Promise<CertificateClientEnrollment> {
  const client = createManagementClient(session)
  const response = await client.post<unknown>('/certificates/clients')
  const record = toRecord(response.data)
  const homeJwt = readString(record, 'home_jwt')
  const id = readString(record, 'id')

  if (!homeJwt) {
    throw new Error('Management API did not return home_jwt.')
  }

  return {
    id: id ?? '',
    homeJwt,
  }
}

export async function runManagementApiCall(
  session: ManagementSessionInput,
  input: ApiCallInput,
): Promise<ApiCallResult> {
  const client = createManagementClient(session)
  const response = await client.post<unknown>('/api-call', {
    auth_index: input.authIndex.trim() || undefined,
    method: input.method.trim().toUpperCase(),
    url: input.url.trim(),
    header: parseHeaderInput(input.headers),
    data: input.data,
  })
  const record = toRecord(response.data)

  return {
    statusCode:
      typeof record.status_code === 'number' && Number.isFinite(record.status_code)
        ? record.status_code
        : null,
    headers: normalizeHeaders(record.header),
    body: readString(record, 'body') ?? '',
  }
}

export function toSystemNodesApiError(error: unknown) {
  const apiError = toManagementApiError(error)
  return new Error(apiError.message, { cause: error })
}
