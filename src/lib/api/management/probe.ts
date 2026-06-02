import type { AxiosInstance, AxiosResponse } from 'axios'

import { createManagementClient } from '@/lib/api/management/client'
import type {
  CapabilityKey,
  CapabilityMap,
  CapabilityProbeResult,
  ManagementServerInfo,
  ManagementSessionInput,
  RuntimeMode,
} from '@/lib/api/management/types'

const capabilityRequests: Record<
  Exclude<CapabilityKey, 'usageQueue' | 'logs'>,
  {
    path: string
  }
> = {
  nodes: {
    path: '/nodes',
  },
  usage: {
    path: '/api-key-usage',
  },
  requestErrorLogs: {
    path: '/request-error-logs',
  },
  users: {
    path: '/users',
  },
  accessGroups: {
    path: '/channel-groups',
  },
}

const emptyCapabilities: CapabilityMap = {
  nodes: false,
  usage: false,
  usageQueue: false,
  logs: false,
  requestErrorLogs: false,
  users: false,
  accessGroups: false,
}

type ProbedCapabilityKey = keyof typeof capabilityRequests

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readBoolean(record: UnknownRecord, key: string) {
  return typeof record[key] === 'boolean' ? record[key] : null
}

function readBooleanFromKeys(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = readBoolean(record, key)
    if (value !== null) return value
  }
  return null
}

function readDeclaredCapabilityValue(configData: unknown, keys: string[]) {
  if (!isRecord(configData)) return null

  const directCapability = readBooleanFromKeys(configData, keys)
  if (directCapability !== null) return directCapability

  for (const key of ['capabilities', 'management_capabilities', 'management-capabilities']) {
    const capabilities = configData[key]
    if (!isRecord(capabilities)) continue

    const nestedCapability = readBooleanFromKeys(capabilities, keys)
    if (nestedCapability !== null) return nestedCapability
  }

  return null
}

function readDeclaredCapability(configData: unknown, keys: string[]) {
  return readDeclaredCapabilityValue(configData, keys) === true
}

function readDeclaredNodesCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, ['nodes', 'node_management', 'nodeManagement'])
}

function readDeclaredUsageCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, [
    'usage',
    'api_key_usage',
    'apiKeyUsage',
    'api-key-usage',
  ])
}

function readDeclaredLogsCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, ['logs', 'runtime_logs', 'runtimeLogs'])
}

function readDeclaredRequestErrorLogsCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, [
    'request_error_logs',
    'requestErrorLogs',
    'request-error-logs',
  ])
}

function readDeclaredUsersCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, ['users', 'user_management', 'userManagement'])
}

function readDeclaredAccessGroupsCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, [
    'access_groups',
    'accessGroups',
    'channel_groups',
    'channelGroups',
    'model_groups',
    'modelGroups',
  ])
}

function readDeclaredCapabilitiesEndpoint(configData: unknown) {
  return readDeclaredCapability(configData, [
    'capabilities_endpoint',
    'capabilitiesEndpoint',
    'management_capabilities_endpoint',
    'managementCapabilitiesEndpoint',
  ])
}

async function readCapabilitiesPayload(
  client: AxiosInstance,
  configData: unknown,
): Promise<UnknownRecord | null> {
  if (!readDeclaredCapabilitiesEndpoint(configData)) return null

  const response = await client.request<unknown>({
    method: 'GET',
    url: '/capabilities',
    validateStatus: () => true,
  })

  if (response.status === 404 || response.status === 405) return null
  if (response.status >= 400) return null

  return isRecord(response.data) ? response.data : null
}

function getHeader(response: AxiosResponse, name: string): string | undefined {
  const headers = response.headers as Record<string, unknown>
  const value = headers[name.toLowerCase()]
  if (Array.isArray(value)) {
    const firstValue = value[0] as unknown
    return typeof firstValue === 'string' ? firstValue : undefined
  }
  if (typeof value === 'string') return value
  return undefined
}

function readServerInfo(response: AxiosResponse): ManagementServerInfo {
  return {
    cpaVersion: getHeader(response, 'X-CPA-VERSION'),
    cpaCommit: getHeader(response, 'X-CPA-COMMIT'),
    cpaBuildDate: getHeader(response, 'X-CPA-BUILD-DATE'),
    homeVersion: getHeader(response, 'x-cpa-home-version'),
    homeCommit: getHeader(response, 'x-cpa-home-commit'),
    homeBuildDate: getHeader(response, 'x-cpa-home-build-date'),
  }
}

function inferRuntimeMode(
  capabilities: CapabilityMap,
  serverInfo: ManagementServerInfo,
): RuntimeMode {
  if (!capabilities.nodes && !serverInfo.homeVersion) {
    return 'cpa'
  }

  if (capabilities.nodes && !capabilities.usage) {
    return 'home-cluster'
  }

  if (capabilities.nodes || serverInfo.homeVersion) {
    return 'home-standalone'
  }

  return 'unknown'
}

async function probeCapability(client: AxiosInstance, key: ProbedCapabilityKey) {
  const request = capabilityRequests[key]
  const response = await client.request<unknown>({
    method: 'GET',
    url: request.path,
    validateStatus: () => true,
  })

  if (response.status === 404) return false
  if (response.status === 405) return false
  return true
}

export async function probeManagementRuntime(
  session: ManagementSessionInput,
): Promise<CapabilityProbeResult> {
  const client = createManagementClient(session)
  const configResponse = await client.get<unknown>('/config')
  const capabilitiesPayload = await readCapabilitiesPayload(client, configResponse.data)
  const capabilitySource = capabilitiesPayload ?? configResponse.data
  const serverInfo = readServerInfo(configResponse)
  const declaredNodes = capabilitiesPayload ? readDeclaredNodesCapability(capabilitySource) : null
  const declaredUsage = capabilitiesPayload ? readDeclaredUsageCapability(capabilitySource) : null
  const declaredLogs = capabilitiesPayload ? readDeclaredLogsCapability(capabilitySource) : null
  const declaredRequestErrorLogs = capabilitiesPayload
    ? readDeclaredRequestErrorLogsCapability(capabilitySource)
    : null
  const declaredUsers = capabilitiesPayload ? readDeclaredUsersCapability(capabilitySource) : null
  const declaredAccessGroups = capabilitiesPayload
    ? readDeclaredAccessGroupsCapability(capabilitySource)
    : null

  const probedCapabilityEntries = await Promise.all(
    (Object.keys(capabilityRequests) as ProbedCapabilityKey[]).map(async (key) => {
      try {
        return [key, await probeCapability(client, key)] as const
      } catch {
        return [key, false] as const
      }
    }),
  )

  const probedCapabilities = probedCapabilityEntries.reduce<CapabilityMap>(
    (nextCapabilities, [key, available]) => ({
      ...nextCapabilities,
      [key]: available,
    }),
    emptyCapabilities,
  )
  const capabilities: CapabilityMap = {
    ...probedCapabilities,
    nodes: declaredNodes ?? probedCapabilities.nodes,
    usage: declaredUsage ?? probedCapabilities.usage,
    users: declaredUsers ?? probedCapabilities.users,
    usageQueue: false,
    // GET /logs returns 400 when file logging is disabled, so probing it would create
    // console noise. Standalone runtimes that expose usage routes also expose the log
    // route family; the usage page decides separately whether config should read lines.
    logs: declaredLogs ?? declaredUsage ?? probedCapabilities.usage,
    requestErrorLogs: declaredRequestErrorLogs ?? probedCapabilities.requestErrorLogs,
    accessGroups: declaredAccessGroups ?? probedCapabilities.accessGroups,
  }

  return {
    capabilities,
    runtimeMode: inferRuntimeMode(capabilities, serverInfo),
    serverInfo,
    probedAt: new Date().toISOString(),
  }
}
