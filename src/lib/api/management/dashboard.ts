import type { AxiosInstance } from 'axios'

import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import { fetchModelsSnapshot } from '@/lib/api/management/models'
import type { CapabilityMap, ManagementSessionInput, RuntimeMode } from '@/lib/api/management/types'
import { type UsageOverview, fetchUsageOverview } from '@/lib/api/management/usage-logs'

type UnknownRecord = Record<string, unknown>

type DashboardProviderId = 'gemini' | 'claude' | 'codex' | 'xai' | 'vertex' | 'openaiCompatibility'

type DashboardRequestIssueScope =
  | 'latestVersion'
  | 'clientKeys'
  | 'authFiles'
  | 'models'
  | 'topology'
  | 'nodes'
  | 'usageOverview'
  | DashboardProviderId

type DashboardProviderDescriptor = {
  id: DashboardProviderId
  path: string
  responseKey: string
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
    path: '/gemini-api-key',
    responseKey: 'gemini-api-key',
  },
  {
    id: 'claude',
    path: '/claude-api-key',
    responseKey: 'claude-api-key',
  },
  {
    id: 'codex',
    path: '/codex-api-key',
    responseKey: 'codex-api-key',
  },
  {
    id: 'xai',
    path: '/xai-api-key',
    responseKey: 'xai-api-key',
  },
  {
    id: 'vertex',
    path: '/vertex-api-key',
    responseKey: 'vertex-api-key',
  },
  {
    id: 'openaiCompatibility',
    path: '/openai-compatibility',
    responseKey: 'openai-compatibility',
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
  const records = readArrayRecords(responseData, descriptor.responseKey)
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
  const response = await client.get<unknown>(descriptor.path)
  return normalizeProviderSummary(descriptor, response.data)
}

export async function fetchManagementDashboardSnapshot(
  session: ManagementSessionInput,
  capabilities: CapabilityMap,
  runtimeMode: RuntimeMode = 'unknown',
): Promise<DashboardSnapshot> {
  const client = createManagementClient(session)
  const configResponse = await client.get<unknown>('/config')
  const config = toRecord(configResponse.data)
  const issues: DashboardRequestIssue[] = []
  const fallbackClientKeys = readStringArray(config, 'api-keys')
  const providerDescriptors =
    runtimeMode === 'cpa'
      ? dashboardProviderDescriptors.filter((descriptor) => descriptor.id !== 'xai')
      : dashboardProviderDescriptors

  const [
    latestVersion,
    clientKeys,
    authFiles,
    availableModels,
    providers,
    topology,
    nodes,
    usageOverview,
  ] = await Promise.all([
    readOptional(
      issues,
      'latestVersion',
      async () => {
        const response = await client.get<unknown>('/latest-version')
        return readString(toRecord(response.data)['latest-version'])
      },
      null,
    ),
    readOptional(
      issues,
      'clientKeys',
      async () => {
        const response = await client.get<unknown>('/api-keys')
        return readStringArray(response.data, 'api-keys')
      },
      fallbackClientKeys,
    ),
    readOptional(
      issues,
      'authFiles',
      async () => {
        const response = await client.get<unknown>('/auth-files')
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

  return {
    fetchedAt: new Date().toISOString(),
    config,
    latestVersion,
    clientKeys,
    authFiles,
    availableModels,
    providers,
    nodes: fallbackNodes,
    nodeTopology,
    usageOverview,
    issues,
  }
}
