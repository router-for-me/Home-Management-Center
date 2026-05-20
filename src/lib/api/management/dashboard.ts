import type { AxiosInstance } from 'axios'

import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { CapabilityMap, ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

type DashboardProviderId =
  | 'gemini'
  | 'claude'
  | 'codex'
  | 'vertex'
  | 'openaiCompatibility'
  | 'ampcode'

type DashboardRequestIssueScope =
  | 'latestVersion'
  | 'clientKeys'
  | 'authFiles'
  | 'nodes'
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

type DashboardNodeSummary = {
  ip: string
  connectedTime: string | null
}

export type DashboardSnapshot = {
  fetchedAt: string
  config: UnknownRecord
  latestVersion: string | null
  clientKeys: string[]
  authFiles: DashboardAuthFileSummary[]
  providers: DashboardProviderSummary[]
  nodes: DashboardNodeSummary[]
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
    id: 'vertex',
    path: '/vertex-api-key',
    responseKey: 'vertex-api-key',
  },
  {
    id: 'openaiCompatibility',
    path: '/openai-compatibility',
    responseKey: 'openai-compatibility',
  },
  {
    id: 'ampcode',
    path: '/ampcode/upstream-api-keys',
    responseKey: 'upstream-api-keys',
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
    connectedTime: readString(record.connected_time),
  }))
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
): Promise<DashboardSnapshot> {
  const client = createManagementClient(session)
  const configResponse = await client.get<unknown>('/config')
  const config = toRecord(configResponse.data)
  const issues: DashboardRequestIssue[] = []
  const fallbackClientKeys = readStringArray(config, 'api-keys')

  const [latestVersion, clientKeys, authFiles, providers, nodes] = await Promise.all([
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
    Promise.all(
      dashboardProviderDescriptors.map((descriptor) =>
        readOptional(issues, descriptor.id, async () => fetchProviderSummary(client, descriptor), {
          ...descriptor,
          total: 0,
          active: 0,
          disabled: 0,
        }),
      ),
    ),
    capabilities.nodes
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
  ])

  return {
    fetchedAt: new Date().toISOString(),
    config,
    latestVersion,
    clientKeys,
    authFiles,
    providers,
    nodes,
    issues,
  }
}
