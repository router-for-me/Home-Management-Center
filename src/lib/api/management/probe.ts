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
  Exclude<
    CapabilityKey,
    | 'usageQueue'
    | 'logs'
    | 'usageAggregates'
    | 'usageRecordDetails'
    | 'usageExport'
    | 'usageProviderHealth'
    | 'usageCredentialHealth'
    | 'usageRealtime'
    | 'usageTokenBreakdownV2'
    | 'requestEventDetails'
    | 'requestEventExport'
    | 'requestLogIndex'
    | 'oauthUsage'
    | 'quotaSnapshots'
    | 'quotaSnapshotDetails'
    | 'credentialInFlight'
    | 'credentialInFlightSnapshotCursor'
    | 'credentialConcurrencyLimits'
    | 'quotaRecollect'
    | 'modelChannelBindings'
  >,
  {
    path: string
  }
> = {
  topology: {
    path: '/topology',
  },
  nodes: {
    path: '/nodes',
  },
  usage: {
    path: '/api-key-usage',
  },
  usageOverview: {
    path: '/usage/overview',
  },
  usageRecords: {
    path: '/usage/records?limit=1',
  },
  requestEvents: {
    path: '/request-events?limit=1',
  },
  requestEventFilters: {
    path: '/request-events/filter-options?limit=1',
  },
  requestErrorLogs: {
    path: '/request-error-logs',
  },
  users: {
    path: '/users',
  },
  userPeriodLimits: {
    // Fallback for Home builds that expose the routes but predate the
    // user_period_limits capability declaration: those answer 400 for the
    // invalid id, older builds without the routes answer 404.
    path: '/users/0/period-limits',
  },
  accessGroups: {
    path: '/channel-groups',
  },
}

const emptyCapabilities: CapabilityMap = {
  nodes: false,
  topology: false,
  usage: false,
  usageQueue: false,
  usageOverview: false,
  usageRecords: false,
  usageRecordDetails: false,
  usageAggregates: false,
  usageExport: false,
  usageProviderHealth: false,
  usageCredentialHealth: false,
  usageRealtime: false,
  usageTokenBreakdownV2: false,
  requestEvents: false,
  requestEventDetails: false,
  requestEventExport: false,
  requestEventFilters: false,
  requestLogIndex: false,
  oauthUsage: false,
  quotaSnapshots: false,
  quotaSnapshotDetails: false,
  quotaRecollect: false,
  logs: false,
  requestErrorLogs: false,
  users: false,
  userPeriodLimits: false,
  accessGroups: false,
  modelChannelBindings: false,
  credentialInFlight: false,
  credentialInFlightSnapshotCursor: false,
  credentialConcurrencyLimits: false,
}

type ProbedCapabilityKey = keyof typeof capabilityRequests

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readBoolean(record: UnknownRecord, key: string) {
  return typeof record[key] === 'boolean' ? record[key] : null
}

function readString(record: UnknownRecord, key: string) {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function readStringFromKeys(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = readString(record, key)
    if (value !== undefined) return value
  }

  return undefined
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

function readDeclaredNodesCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, ['nodes', 'node_management', 'nodeManagement'])
}

function readDeclaredTopologyCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, [
    'topology',
    'cluster_topology',
    'clusterTopology',
  ])
}

function readDeclaredUsageCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, [
    'usage',
    'api_key_usage',
    'apiKeyUsage',
    'api-key-usage',
  ])
}

function readDeclaredUsageOverviewCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, ['usage_overview', 'usageOverview'])
}

function readDeclaredUsageRecordsCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, ['usage_records', 'usageRecords'])
}

function readDeclaredUsageRecordDetailsCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, [
    'usage_record_details',
    'usageRecordDetails',
    'usage_details',
    'usageDetails',
  ])
}

function readDeclaredUsageAggregatesCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, ['usage_aggregates', 'usageAggregates'])
}

function readDeclaredUsageExportCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, ['usage_export', 'usageExport'])
}

function readDeclaredUsageProviderHealthCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, [
    'usage_provider_health',
    'usageProviderHealth',
    'usage_health_providers',
    'usageHealthProviders',
  ])
}

function readDeclaredUsageCredentialHealthCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, [
    'usage_credential_health',
    'usageCredentialHealth',
    'usage_health_credentials',
    'usageHealthCredentials',
  ])
}

function readDeclaredUsageRealtimeCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, [
    'usage_realtime',
    'usageRealtime',
    'usage_realtime_snapshot',
    'usageRealtimeSnapshot',
  ])
}

export function readDeclaredUsageTokenBreakdownV2Capability(capabilitiesData: unknown) {
  if (!isRecord(capabilitiesData)) return false
  const capabilities = capabilitiesData.capabilities
  if (!isRecord(capabilities)) return false
  return readBoolean(capabilities, 'usage_token_breakdown_v2') === true
}

function readDeclaredCredentialInFlightCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, ['credential_in_flight_snapshots'])
}

function readDeclaredCredentialInFlightSnapshotCursorCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, ['credential_in_flight_snapshot_cursor'])
}

function readDeclaredCredentialConcurrencyLimitsCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, ['credential_concurrency_limits_v2'])
}

function readDeclaredRequestEventsCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, [
    'request_events',
    'requestEvents',
    'request-event-log',
    'request_event_log',
    'requestEventLog',
  ])
}

function readDeclaredRequestEventDetailsCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, [
    'request_event_details',
    'requestEventDetails',
    'request_events_details',
    'requestEventsDetails',
  ])
}

function readDeclaredRequestEventExportCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, [
    'request_event_export',
    'requestEventExport',
    'request_events_export',
    'requestEventsExport',
  ])
}

function readDeclaredRequestEventFiltersCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, [
    'request_event_filters',
    'requestEventFilters',
    'request_events_filters',
    'requestEventsFilters',
  ])
}

function readDeclaredRequestLogIndexCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, [
    'request_log_index',
    'requestLogIndex',
    'request_logs',
    'requestLogs',
  ])
}

function readDeclaredOauthUsageCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, ['oauth_usage', 'oauthUsage'])
}

function readDeclaredQuotaSnapshotsCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, ['quota_snapshots', 'quotaSnapshots'])
}

function readDeclaredQuotaSnapshotDetailsCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, ['quota_snapshot_details', 'quotaSnapshotDetails'])
}

function readDeclaredQuotaRecollectCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, [
    'quota_recollect',
    'quotaRecollect',
    'quota_collect',
    'quotaCollect',
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

function readDeclaredUserPeriodLimitsCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, [
    'user_period_limits',
    'userPeriodLimits',
    'period_limits',
    'periodLimits',
  ])
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

function readDeclaredModelChannelBindingsCapability(configData: unknown) {
  return readDeclaredCapabilityValue(configData, ['model_channel_bindings', 'modelChannelBindings'])
}

async function readCapabilitiesPayload(client: AxiosInstance): Promise<UnknownRecord | null> {
  const response = await client.request<unknown>({
    method: 'GET',
    url: '/capabilities',
    validateStatus: () => true,
  })

  if (response.status === 404 || response.status === 405) return null
  if (response.status >= 400) return null

  return isRecord(response.data) ? response.data : null
}

export async function fetchDeclaredUsageTokenBreakdownV2Capability(
  session: ManagementSessionInput,
): Promise<boolean | null> {
  const client = createManagementClient(session)
  const payload = await readCapabilitiesPayload(client)
  return payload === null ? null : readDeclaredUsageTokenBreakdownV2Capability(payload)
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

function readDeclaredServerInfo(capabilitiesData: unknown): Partial<ManagementServerInfo> {
  if (!isRecord(capabilitiesData)) return {}

  const rawServerInfo = capabilitiesData.server_info ?? capabilitiesData.serverInfo
  if (!isRecord(rawServerInfo)) return {}

  return {
    homeVersion: readStringFromKeys(rawServerInfo, ['home_version', 'homeVersion']),
    homeCommit: readStringFromKeys(rawServerInfo, ['home_commit', 'homeCommit']),
    homeBuildDate: readStringFromKeys(rawServerInfo, ['home_build_date', 'homeBuildDate']),
  }
}

function mergeServerInfo(
  headerServerInfo: ManagementServerInfo,
  declaredServerInfo: Partial<ManagementServerInfo>,
): ManagementServerInfo {
  return {
    ...headerServerInfo,
    homeVersion: declaredServerInfo.homeVersion ?? headerServerInfo.homeVersion,
    homeCommit: declaredServerInfo.homeCommit ?? headerServerInfo.homeCommit,
    homeBuildDate: declaredServerInfo.homeBuildDate ?? headerServerInfo.homeBuildDate,
  }
}

function inferRuntimeMode(
  capabilities: CapabilityMap,
  serverInfo: ManagementServerInfo,
): RuntimeMode {
  if (!capabilities.topology && !capabilities.nodes && !serverInfo.homeVersion) {
    return 'cpa'
  }

  if (capabilities.topology) {
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
  const capabilitiesPayload = await readCapabilitiesPayload(client)
  const capabilitySource = capabilitiesPayload ?? configResponse.data
  const serverInfo = mergeServerInfo(
    readServerInfo(configResponse),
    capabilitiesPayload ? readDeclaredServerInfo(capabilitiesPayload) : {},
  )
  const declaredNodes = capabilitiesPayload ? readDeclaredNodesCapability(capabilitySource) : null
  const declaredTopology = capabilitiesPayload
    ? readDeclaredTopologyCapability(capabilitySource)
    : null
  const declaredUsage = capabilitiesPayload ? readDeclaredUsageCapability(capabilitySource) : null
  const declaredUsageOverview = capabilitiesPayload
    ? readDeclaredUsageOverviewCapability(capabilitySource)
    : null
  const declaredUsageRecords = capabilitiesPayload
    ? readDeclaredUsageRecordsCapability(capabilitySource)
    : null
  const declaredUsageRecordDetails = capabilitiesPayload
    ? readDeclaredUsageRecordDetailsCapability(capabilitySource)
    : null
  const declaredUsageAggregates = capabilitiesPayload
    ? readDeclaredUsageAggregatesCapability(capabilitySource)
    : null
  const declaredUsageExport = capabilitiesPayload
    ? readDeclaredUsageExportCapability(capabilitySource)
    : null
  const declaredUsageProviderHealth = capabilitiesPayload
    ? readDeclaredUsageProviderHealthCapability(capabilitySource)
    : null
  const declaredUsageCredentialHealth = capabilitiesPayload
    ? readDeclaredUsageCredentialHealthCapability(capabilitySource)
    : null
  const declaredUsageRealtime = capabilitiesPayload
    ? readDeclaredUsageRealtimeCapability(capabilitySource)
    : null
  const declaredUsageTokenBreakdownV2 = capabilitiesPayload
    ? readDeclaredUsageTokenBreakdownV2Capability(capabilitiesPayload)
    : false
  const declaredRequestEvents = capabilitiesPayload
    ? readDeclaredRequestEventsCapability(capabilitySource)
    : null
  const declaredRequestEventDetails = capabilitiesPayload
    ? readDeclaredRequestEventDetailsCapability(capabilitySource)
    : null
  const declaredRequestEventExport = capabilitiesPayload
    ? readDeclaredRequestEventExportCapability(capabilitySource)
    : null
  const declaredRequestEventFilters = capabilitiesPayload
    ? readDeclaredRequestEventFiltersCapability(capabilitySource)
    : null
  const declaredRequestLogIndex = capabilitiesPayload
    ? readDeclaredRequestLogIndexCapability(capabilitySource)
    : null
  const declaredOauthUsage = capabilitiesPayload
    ? readDeclaredOauthUsageCapability(capabilitySource)
    : null
  const declaredQuotaSnapshots = capabilitiesPayload
    ? readDeclaredQuotaSnapshotsCapability(capabilitySource)
    : null
  const declaredQuotaSnapshotDetails = capabilitiesPayload
    ? readDeclaredQuotaSnapshotDetailsCapability(capabilitySource)
    : null
  const declaredQuotaRecollect = capabilitiesPayload
    ? readDeclaredQuotaRecollectCapability(capabilitySource)
    : null
  const declaredLogs = capabilitiesPayload ? readDeclaredLogsCapability(capabilitySource) : null
  const declaredRequestErrorLogs = capabilitiesPayload
    ? readDeclaredRequestErrorLogsCapability(capabilitySource)
    : null
  const declaredUsers = capabilitiesPayload ? readDeclaredUsersCapability(capabilitySource) : null
  const declaredUserPeriodLimits = capabilitiesPayload
    ? readDeclaredUserPeriodLimitsCapability(capabilitySource)
    : null
  const declaredAccessGroups = capabilitiesPayload
    ? readDeclaredAccessGroupsCapability(capabilitySource)
    : null
  const declaredModelChannelBindings = capabilitiesPayload
    ? readDeclaredModelChannelBindingsCapability(capabilitySource)
    : null
  const declaredCredentialInFlight = capabilitiesPayload
    ? readDeclaredCredentialInFlightCapability(capabilitySource)
    : null
  const declaredCredentialInFlightSnapshotCursor = capabilitiesPayload
    ? readDeclaredCredentialInFlightSnapshotCursorCapability(capabilitySource)
    : null
  const declaredCredentialConcurrencyLimits = capabilitiesPayload
    ? readDeclaredCredentialConcurrencyLimitsCapability(capabilitySource)
    : null

  const capabilityKeysToProbe: ProbedCapabilityKey[] = capabilitiesPayload
    ? [
        ...(declaredTopology === null ? (['topology'] as const) : []),
        ...(declaredTopology !== true && declaredNodes === null ? (['nodes'] as const) : []),
        ...(declaredRequestEvents === null ? (['requestEvents'] as const) : []),
        ...(declaredRequestEventFilters === null ? (['requestEventFilters'] as const) : []),
        'users',
        ...(declaredUserPeriodLimits === null ? (['userPeriodLimits'] as const) : []),
        'accessGroups',
      ]
    : (Object.keys(capabilityRequests) as ProbedCapabilityKey[])

  const probedCapabilityEntries = await Promise.all(
    capabilityKeysToProbe.map(async (key) => {
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
    topology: declaredTopology ?? probedCapabilities.topology,
    nodes: declaredNodes ?? probedCapabilities.nodes,
    usage: declaredUsage ?? probedCapabilities.usage,
    usageOverview: declaredUsageOverview ?? probedCapabilities.usageOverview,
    usageRecords: declaredUsageRecords ?? probedCapabilities.usageRecords,
    usageRecordDetails:
      declaredUsageRecordDetails ?? declaredUsageRecords ?? probedCapabilities.usageRecords,
    usageAggregates: declaredUsageAggregates ?? false,
    usageExport: declaredUsageExport ?? false,
    usageProviderHealth: declaredUsageProviderHealth ?? false,
    usageCredentialHealth: declaredUsageCredentialHealth ?? false,
    usageRealtime: declaredUsageRealtime ?? false,
    usageTokenBreakdownV2: declaredUsageTokenBreakdownV2,
    requestEvents: declaredRequestEvents ?? probedCapabilities.requestEvents,
    requestEventDetails:
      declaredRequestEventDetails ?? declaredRequestEvents ?? probedCapabilities.requestEvents,
    requestEventExport: declaredRequestEventExport ?? false,
    requestEventFilters: declaredRequestEventFilters ?? probedCapabilities.requestEventFilters,
    requestLogIndex: declaredRequestLogIndex ?? false,
    oauthUsage: declaredOauthUsage ?? declaredUsageAggregates ?? false,
    quotaSnapshots: declaredQuotaSnapshots ?? false,
    quotaSnapshotDetails: declaredQuotaSnapshotDetails ?? false,
    quotaRecollect: declaredQuotaRecollect ?? false,
    users: declaredUsers ?? probedCapabilities.users,
    userPeriodLimits: declaredUserPeriodLimits ?? probedCapabilities.userPeriodLimits,
    usageQueue: false,
    // GET /logs returns 400 when file logging is disabled, so probing it would create
    // console noise. Standalone runtimes that expose usage routes also expose the log
    // route family; the usage page decides separately whether config should read lines.
    logs: declaredLogs ?? declaredUsage ?? probedCapabilities.usage,
    requestErrorLogs: declaredRequestErrorLogs ?? probedCapabilities.requestErrorLogs,
    accessGroups: declaredAccessGroups ?? probedCapabilities.accessGroups,
    // The model-group-details routes predate per-model channel bindings, so an HTTP
    // status probe cannot detect support; only the declared capability bit can.
    modelChannelBindings: declaredModelChannelBindings ?? false,
    credentialInFlight: declaredCredentialInFlight ?? false,
    credentialInFlightSnapshotCursor: declaredCredentialInFlightSnapshotCursor ?? false,
    credentialConcurrencyLimits: declaredCredentialConcurrencyLimits ?? false,
  }

  return {
    capabilities,
    runtimeMode: inferRuntimeMode(capabilities, serverInfo),
    serverInfo,
    probedAt: new Date().toISOString(),
  }
}
