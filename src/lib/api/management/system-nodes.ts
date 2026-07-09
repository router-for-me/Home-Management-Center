import type { AxiosResponse } from 'axios'

import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { CapabilityMap, ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type SystemNodeResource = {
  id: string
  ip: string
  nodeId: string | null
  homeId: string | null
  homeIp: string | null
  homePort: number | null
  health: SystemNodeHealth
  lastSeenAt: string | null
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

export type SystemNodeHealth = 'healthy' | 'stale' | 'unknown'

export type SystemHomeRole = 'master' | 'follower' | 'unknown'

export type SystemTopologySource = 'topology' | 'nodes' | 'unsupported'

export type SystemTopologySummary = {
  homeCount: number
  healthyHomeCount: number
  staleHomeCount: number
  unknownHomeCount: number
  cpaCount: number
  healthyCpaCount: number
  staleCpaCount: number
  unknownCpaCount: number
  pluginAttentionCount: number
  attentionCount: number
  missingMaster: boolean
  staleAfterSeconds: number | null
  retentionAfterSeconds: number | null
}

export type SystemTopologyHomeIdentity = {
  id: string | null
  ip: string | null
  port: number | null
}

export type SystemHomeTopologyResource = {
  id: string
  ip: string | null
  port: number | null
  role: SystemHomeRole
  isMaster: boolean
  reportedMaster: boolean | null
  health: SystemNodeHealth
  healthy: boolean | null
  clientCount: number | null
  startedAt: string | null
  lastSeenAt: string | null
  cpaCount: number
  healthyCpaCount: number
  staleCpaCount: number
  unknownCpaCount: number
}

export type SystemTopologySnapshot = {
  summary: SystemTopologySummary
  management: SystemTopologyHomeIdentity | null
  master: SystemHomeTopologyResource | null
  homes: SystemHomeTopologyResource[]
  cpas: SystemNodeResource[]
}

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

export type SystemIssueScope = 'latestVersion' | 'config' | 'nodes' | 'topology' | 'apiCall'

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
  topologySource: SystemTopologySource
  topology: SystemTopologySnapshot | null
  homes: SystemHomeTopologyResource[]
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

function readNumberOrDefault(record: UnknownRecord, key: string, fallback = 0): number {
  return readNumber(record, key) ?? fallback
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

function normalizeNodeHealth(value: string | null, healthy: boolean | null): SystemNodeHealth {
  if (value === 'healthy' || value === 'stale' || value === 'unknown') return value
  if (healthy === true) return 'healthy'
  if (healthy === false) return 'stale'
  return 'unknown'
}

function normalizeHomeRole(value: string | null): SystemHomeRole {
  if (value === 'master' || value === 'follower' || value === 'unknown') return value
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
    const homeIp = readString(record, 'home_ip')
    const homePort = readNumber(record, 'home_port')
    const homeId = readString(record, 'home_id') ?? (homeIp ? `${homeIp}:${homePort ?? 0}` : null)
    const homeKey = homeId ?? `${homeIp ?? 'unknown'}:${homePort ?? 0}`
    const nodeKey = nodeId ?? ip
    const healthy = readOptionalBoolean(record, 'healthy')

    return {
      id: `${homeKey}/${nodeKey}`,
      ip,
      nodeId,
      homeId,
      homeIp,
      homePort,
      health: normalizeNodeHealth(readString(record, 'health'), healthy),
      lastSeenAt: readString(record, 'last_seen_at'),
      connectedTime: readString(record, 'connected_time'),
      clientCount: readNumber(record, 'client_count'),
      healthy,
      pluginReportState: normalizePluginReportState(readString(record, 'plugin_report_state')),
      pluginReportStatuses: normalizePluginReportStatuses(record.plugin_report_statuses),
    }
  })
}

function normalizeTopologySummary(value: unknown): SystemTopologySummary {
  const summary = toRecord(value)

  return {
    homeCount: readNumberOrDefault(summary, 'home_count'),
    healthyHomeCount: readNumberOrDefault(summary, 'healthy_home_count'),
    staleHomeCount: readNumberOrDefault(summary, 'stale_home_count'),
    unknownHomeCount: readNumberOrDefault(summary, 'unknown_home_count'),
    cpaCount: readNumberOrDefault(summary, 'cpa_count'),
    healthyCpaCount: readNumberOrDefault(summary, 'healthy_cpa_count'),
    staleCpaCount: readNumberOrDefault(summary, 'stale_cpa_count'),
    unknownCpaCount: readNumberOrDefault(summary, 'unknown_cpa_count'),
    pluginAttentionCount: readNumberOrDefault(summary, 'plugin_attention_count'),
    attentionCount: readNumberOrDefault(summary, 'attention_count'),
    missingMaster: readBoolean(summary, 'missing_master'),
    staleAfterSeconds: readNumber(summary, 'stale_after_seconds'),
    retentionAfterSeconds: readNumber(summary, 'retention_after_seconds'),
  }
}

function normalizeTopologyIdentity(value: unknown): SystemTopologyHomeIdentity | null {
  const record = toRecord(value)
  const id = readString(record, 'home_id') ?? readString(record, 'id')
  const ip = readString(record, 'home_ip') ?? readString(record, 'ip')
  const port = readNumber(record, 'home_port') ?? readNumber(record, 'port')

  if (!id && !ip && port === null) return null

  return {
    id: id ?? (ip ? (port ? `${ip}:${port}` : ip) : null),
    ip,
    port,
  }
}

function normalizeTopologyHome(value: unknown, index: number): SystemHomeTopologyResource | null {
  const record = toRecord(value)
  const identity = normalizeTopologyIdentity(record)
  const id = identity?.id ?? `home-${index + 1}`
  const healthy = readOptionalBoolean(record, 'healthy')
  const isMaster = readOptionalBoolean(record, 'is_master') === true
  const role = normalizeHomeRole(readString(record, 'role') ?? (isMaster ? 'master' : null))

  if (!identity?.id && !identity?.ip && role === 'unknown' && healthy === null) return null

  return {
    id,
    ip: identity?.ip ?? null,
    port: identity?.port ?? null,
    role,
    isMaster: isMaster || role === 'master',
    reportedMaster: readOptionalBoolean(record, 'reported_master'),
    health: normalizeNodeHealth(readString(record, 'health'), healthy),
    healthy,
    clientCount: readNumber(record, 'client_count'),
    startedAt: readString(record, 'started_at'),
    lastSeenAt: readString(record, 'last_seen_at'),
    cpaCount: readNumberOrDefault(record, 'cpa_count'),
    healthyCpaCount: readNumberOrDefault(record, 'healthy_cpa_count'),
    staleCpaCount: readNumberOrDefault(record, 'stale_cpa_count'),
    unknownCpaCount: readNumberOrDefault(record, 'unknown_cpa_count'),
  }
}

function normalizeTopologyCpas(responseData: unknown): SystemNodeResource[] {
  return readArrayRecords(responseData, 'cpas').map((record, index) => {
    const ip = readString(record, 'ip') ?? `cpa-${index + 1}`
    const nodeId = readString(record, 'node_id')
    const homeIp = readString(record, 'home_ip')
    const homePort = readNumber(record, 'home_port')
    const homeId = readString(record, 'home_id') ?? (homeIp ? `${homeIp}:${homePort ?? 0}` : null)
    const homeKey = homeId ?? `${homeIp ?? 'unknown'}:${homePort ?? 0}`
    const nodeKey = nodeId ?? ip
    const healthy = readOptionalBoolean(record, 'healthy')

    return {
      id: `${homeKey}/${nodeKey}`,
      ip,
      nodeId,
      homeId,
      homeIp,
      homePort,
      health: normalizeNodeHealth(readString(record, 'health'), healthy),
      lastSeenAt: readString(record, 'last_seen_at'),
      connectedTime: readString(record, 'connected_time'),
      clientCount: readNumber(record, 'client_count'),
      healthy,
      pluginReportState: normalizePluginReportState(readString(record, 'plugin_report_state')),
      pluginReportStatuses: normalizePluginReportStatuses(record.plugin_report_statuses),
    }
  })
}

function normalizeTopology(responseData: unknown): SystemTopologySnapshot {
  const data = toRecord(responseData)
  const homes = readArrayRecords(data, 'homes').flatMap((item, index) => {
    const home = normalizeTopologyHome(item, index)
    return home ? [home] : []
  })
  const master = normalizeTopologyHome(data.master, -1)
  const cpas = normalizeTopologyCpas(data)

  return {
    summary: normalizeTopologySummary(data.summary),
    management: normalizeTopologyIdentity(data.management),
    master,
    homes,
    cpas,
  }
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

  const [, config, topologyResponseData, nodesResponseData] = await Promise.all([
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
    capabilities.topology
      ? readOptional(
          issues,
          'topology',
          async () => {
            const response = await client.get<unknown>('/topology')
            return toRecord(response.data)
          },
          {},
        )
      : Promise.resolve({}),
    !capabilities.topology && capabilities.nodes
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
  const topologyData = toRecord(topologyResponseData)
  let nodesData = toRecord(nodesResponseData)
  const topology =
    capabilities.topology && Object.keys(topologyData).length > 0
      ? normalizeTopology(topologyData)
      : null

  if (!topology && capabilities.nodes && Object.keys(nodesData).length === 0) {
    nodesData = await readOptional(
      issues,
      'nodes',
      async () => {
        const response = await client.get<unknown>('/nodes')
        return toRecord(response.data)
      },
      {},
    )
  }

  const nodes = topology ? topology.cpas : normalizeNodes(nodesData)
  const topologySource: SystemTopologySource = topology
    ? 'topology'
    : capabilities.nodes
      ? 'nodes'
      : 'unsupported'

  return {
    fetchedAt: new Date().toISOString(),
    homeVersion,
    latestVersion,
    config,
    pluginReportRequired: readBoolean(nodesData, 'plugin_report_required'),
    pluginReportStatuses: normalizePluginReportStatuses(nodesData.plugin_report_statuses),
    topologySource,
    topology,
    homes: topology?.homes ?? [],
    nodes,
    issues,
  }
}

export async function fetchSystemNodePluginReports(
  session: ManagementSessionInput,
  capabilities?: Pick<CapabilityMap, 'topology' | 'nodes'>,
): Promise<SystemNodePluginReportSnapshot> {
  const client = createManagementClient(session)

  if (capabilities?.topology) {
    try {
      const response = await client.get<unknown>('/topology')
      const topology = normalizeTopology(response.data)
      const pluginReportStatuses = topology.cpas.flatMap((node) => node.pluginReportStatuses)

      return {
        fetchedAt: new Date().toISOString(),
        pluginReportRequired: topology.cpas.some(
          (node) =>
            node.pluginReportState !== 'not_required' && node.pluginReportState !== 'unknown',
        ),
        pluginReportStatuses,
        nodes: topology.cpas,
      }
    } catch (error) {
      if (!capabilities.nodes) throw error
    }
  }

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
