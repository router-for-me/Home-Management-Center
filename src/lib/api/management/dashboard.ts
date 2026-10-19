import type { AxiosInstance } from 'axios'

import {
  type AccessKeyResource,
  normalizeAccessKey,
  readEntries,
} from '@/lib/api/management/access-keys'
import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import { fetchModelsSnapshot } from '@/lib/api/management/models'
import type { CapabilityMap, ManagementSessionInput, RuntimeMode } from '@/lib/api/management/types'
import { type UsageOverview, fetchUsageOverview } from '@/lib/api/management/usage-logs'
import { type UserResource, fetchUsersSnapshot } from '@/lib/api/management/users'

type UnknownRecord = Record<string, unknown>

type DashboardProviderId =
  | 'gemini'
  | 'interactions'
  | 'claude'
  | 'codex'
  | 'xai'
  | 'meta'
  | 'vertex'
  | 'openaiCompatibility'

type DashboardRequestIssueScope =
  | 'latestVersion'
  | 'clientKeys'
  | 'authFiles'
  | 'models'
  | 'topology'
  | 'nodes'
  | 'usageOverview'
  | 'users'
  | DashboardProviderId

type DashboardProviderDescriptor = {
  id: DashboardProviderId
  path: string
}

type DashboardRequestIssue = {
  scope: DashboardRequestIssueScope
  message: string
  status?: number
  code?: string
}

type DashboardProviderSummary = DashboardProviderDescriptor & {
  total: number
  active: number
  disabled: number
}

type DashboardAuthFileSummary = {
  id: string
  provider: string
  source: string
  status: string
  disabled: boolean
  unavailable: boolean
}

export type DashboardAvailableModelsSummary = {
  status: 'loaded' | 'error'
  count: number
}

type DashboardNodeSummary = {
  ip: string
  homeIp: string | null
  homePort: number | null
  connectedTime: string | null
}

export type DashboardNodeTopologySummary = {
  source: 'topology' | 'nodes'
  homeCount: number
  cpaCount: number
  healthyHomeCount: number | null
  healthyCpaCount: number | null
}

export type DashboardSnapshot = {
  fetchedAt: string
  config: UnknownRecord
  latestVersion: string | null
  clientKeys: string[]
  accessKeys?: AccessKeyResource[]
  users?: UserResource[]
  authFiles: DashboardAuthFileSummary[]
  availableModels: DashboardAvailableModelsSummary
  providers: DashboardProviderSummary[]
  nodes: DashboardNodeSummary[]
  nodeTopology: DashboardNodeTopologySummary | null
  usageOverview: UsageOverview | null
  issues: DashboardRequestIssue[]
}

const dashboardProviderDescriptors: DashboardProviderDescriptor[] = [
  {
    id: 'gemini',
    path: '/config/api-keys/gemini',
  },
  {
    id: 'interactions',
    path: '/config/api-keys/interactions',
  },
  {
    id: 'claude',
    path: '/config/api-keys/claude',
  },
  {
    id: 'codex',
    path: '/config/api-keys/codex',
  },
  {
    id: 'xai',
    path: '/config/api-keys/xai',
  },
  {
    id: 'meta',
    path: '/config/api-keys/meta',
  },
  {
    id: 'vertex',
    path: '/config/api-keys/vertex',
  },
  {
    id: 'openaiCompatibility',
    path: '/config/api-keys/openai-compatibility',
  },
]

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function readBoolean(value: unknown): boolean {
  return value === true
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readArrayRecords(value: unknown, key: string): UnknownRecord[] {
  const record = toRecord(value)
  const nextValue = record[key]

  return Array.isArray(nextValue) ? nextValue.filter(isRecord) : []
}

function readStringArray(value: unknown, key: string): string[] {
  const record = toRecord(value)
  const nextValue = record[key]

  return Array.isArray(nextValue)
    ? nextValue.filter((item): item is string => typeof item === 'string')
    : []
}

function normalizeIssue(scope: DashboardRequestIssueScope, error: unknown): DashboardRequestIssue {
  const apiError = toManagementApiError(error)

  return {
    scope,
    message: apiError.message,
    status: apiError.status,
    code: apiError.code,
  }
}

async function readOptional<T>(
  issues: DashboardRequestIssue[],
  scope: DashboardRequestIssueScope,
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

function normalizeProviderSummary(
  descriptor: DashboardProviderDescriptor,
  responseData: unknown,
): DashboardProviderSummary {
  // v8 `GET /config/api-keys/<provider>` returns the raw group array.
  const records = Array.isArray(responseData) ? responseData.filter(isRecord) : []
  const disabled = records.filter((record) => readBoolean(record.disabled)).length

  return {
    ...descriptor,
    total: records.length,
    active: records.length - disabled,
    disabled,
  }
}

function normalizeAuthFiles(responseData: unknown): DashboardAuthFileSummary[] {
  return readArrayRecords(responseData, 'files').map((record, index) => {
    const id =
      readString(record.id) ??
      readString(record.auth_index) ??
      readString(record.name) ??
      `auth-file-${index + 1}`

    return {
      id,
      provider: readString(record.provider) ?? readString(record.type) ?? 'unknown',
      source: readString(record.source) ?? 'unknown',
      status: readString(record.status) ?? 'unknown',
      disabled: readBoolean(record.disabled),
      unavailable: readBoolean(record.unavailable),
    }
  })
}

function normalizeNodes(responseData: unknown): DashboardNodeSummary[] {
  return readArrayRecords(responseData, 'nodes').map((record, index) => ({
    ip: readString(record.ip) ?? `node-${index + 1}`,
    homeIp: readString(record.home_ip),
    homePort: readNumber(record.home_port),
    connectedTime: readString(record.connected_time),
  }))
}

function countServingHomes(nodes: DashboardNodeSummary[]): number {
  return new Set(
    nodes.flatMap((node) => {
      if (!node.homeIp) return []
      return [`${node.homeIp}:${node.homePort ?? 0}`]
    }),
  ).size
}

function normalizeTopologySummary(responseData: unknown): DashboardNodeTopologySummary {
  const summary = toRecord(toRecord(responseData).summary)

  return {
    source: 'topology',
    homeCount: readNumber(summary.home_count) ?? 0,
    cpaCount: readNumber(summary.cpa_count) ?? 0,
    healthyHomeCount: readNumber(summary.healthy_home_count),
    healthyCpaCount: readNumber(summary.healthy_cpa_count),
  }
}

function createNodesTopologySummary(nodes: DashboardNodeSummary[]): DashboardNodeTopologySummary {
  return {
    source: 'nodes',
    homeCount: countServingHomes(nodes),
    cpaCount: nodes.length,
    healthyHomeCount: null,
    healthyCpaCount: null,
  }
}

async function fetchProviderSummary(
  client: AxiosInstance,
  descriptor: DashboardProviderDescriptor,
): Promise<DashboardProviderSummary> {
  try {
    const response = await client.get<unknown>(descriptor.path)
    return normalizeProviderSummary(descriptor, response.data)
  } catch (error) {
    // Absent provider families are pruned from the persisted v8 config view
    // and read back as 404; that means zero configured entries, not a failed
    // or unsupported request.
    if (toManagementApiError(error).status === 404) {
      return { ...descriptor, total: 0, active: 0, disabled: 0 }
    }
    throw error
  }
}

export async function fetchManagementDashboardSnapshot(
  session: ManagementSessionInput,
  capabilities: CapabilityMap,
  runtimeMode: RuntimeMode = 'unknown',
): Promise<DashboardSnapshot> {
  const client = createManagementClient(session)
  const issues: DashboardRequestIssue[] = []
  const providerDescriptors =
    runtimeMode === 'cpa'
      ? dashboardProviderDescriptors.filter((descriptor) => descriptor.id !== 'xai')
      : dashboardProviderDescriptors

  const [
    configResponse,
    latestVersion,
    optionalAccessKeys,
    authFiles,
    availableModels,
    providers,
    topology,
    nodes,
    usageOverview,
    users,
  ] = await Promise.all([
    // Awaited on its own this cost the dashboard a whole round trip before any
    // of the requests below could start, and the only thing the rest of this
    // function needed from it was a fallback that is almost never read.
    client.get<unknown>('/config'),
    readOptional(
      issues,
      'latestVersion',
      async () => {
        const response = await client.get<unknown>('/server/latest-version')
        return readString(toRecord(response.data)['latest-version'])
      },
      null,
    ),
    readOptional<AccessKeyResource[] | null>(
      issues,
      'clientKeys',
      async () => {
        const response = await client.get<unknown>('/access/api-keys')
        const entries = readEntries(response.data)
        return entries.map((entry, index) => normalizeAccessKey(entry, index))
      },
      null,
    ),
    readOptional(
      issues,
      'authFiles',
      async () => {
        const response = await client.get<unknown>('/credentials')
        return normalizeAuthFiles(response.data)
      },
      [],
    ),
    readOptional<DashboardAvailableModelsSummary>(
      issues,
      'models',
      async () => {
        const snapshot = await fetchModelsSnapshot(session, { scope: 'available' })
        return { status: 'loaded' as const, count: snapshot.resources.length }
      },
      { status: 'error' as const, count: 0 },
    ),
    Promise.all(
      providerDescriptors.map((descriptor) =>
        readOptional(issues, descriptor.id, async () => fetchProviderSummary(client, descriptor), {
          ...descriptor,
          total: 0,
          active: 0,
          disabled: 0,
        }),
      ),
    ),
    capabilities.topology
      ? readOptional(
          issues,
          'topology',
          async () => {
            const response = await client.get<unknown>('/topology')
            return normalizeTopologySummary(response.data)
          },
          null,
        )
      : Promise.resolve(null),
    !capabilities.topology && capabilities.nodes
      ? readOptional(
          issues,
          'nodes',
          async () => {
            const response = await client.get<unknown>('/nodes')
            return normalizeNodes(response.data)
          },
          [],
        )
      : Promise.resolve([]),
    capabilities.usageOverview
      ? readOptional(
          issues,
          'usageOverview',
          async () => fetchUsageOverview(session, undefined, capabilities.usageTokenBreakdownV2),
          null,
        )
      : Promise.resolve(null),
    capabilities.users
      ? readOptional(
          issues,
          'users',
          async () => {
            const snapshot = await fetchUsersSnapshot(session)
            return snapshot.resources
          },
          [],
        )
      : Promise.resolve([]),
  ])
  const fallbackNodes =
    !topology && capabilities.topology && capabilities.nodes
      ? await readOptional(
          issues,
          'nodes',
          async () => {
            const response = await client.get<unknown>('/nodes')
            return normalizeNodes(response.data)
          },
          [],
        )
      : nodes
  const nodeTopology =
    topology ?? (capabilities.nodes ? createNodesTopologySummary(fallbackNodes) : null)

  const config = toRecord(configResponse.data)
  // The v8 config tree carries the client-key string-list projection at
  // `access.api-keys`; the dedicated endpoint is authoritative when it answers.
  const fallbackKeys = readStringArray(config.access, 'api-keys')
  const accessKeys =
    optionalAccessKeys ?? fallbackKeys.map((key, index) => normalizeAccessKey(key, index))
  const clientKeys = accessKeys.map((key) => key.value)

  return {
    fetchedAt: new Date().toISOString(),
    config,
    latestVersion,
    clientKeys,
    accessKeys,
    users,
    authFiles,
    availableModels,
    providers,
    nodes: fallbackNodes,
    nodeTopology,
    usageOverview,
    issues,
  }
}
