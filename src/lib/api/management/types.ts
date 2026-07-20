export type CapabilityKey =
  | 'nodes'
  | 'topology'
  | 'usage'
  | 'usageQueue'
  | 'usageOverview'
  | 'usageRecords'
  | 'usageRecordDetails'
  | 'usageAggregates'
  | 'usageExport'
  | 'usageProviderHealth'
  | 'usageCredentialHealth'
  | 'usageRealtime'
  | 'requestEvents'
  | 'requestEventDetails'
  | 'requestEventExport'
  | 'requestEventFilters'
  | 'requestLogIndex'
  | 'oauthUsage'
  | 'quotaSnapshots'
  | 'quotaSnapshotDetails'
  | 'logs'
  | 'requestErrorLogs'
  | 'users'
  | 'accessGroups'
  | 'credentialInFlight'
  | 'credentialConcurrencyLimits'

export type CapabilityMap = Record<CapabilityKey, boolean>

export type RuntimeMode = 'cpa' | 'home-standalone' | 'home-cluster' | 'unknown'

export type ManagementServerInfo = {
  cpaVersion?: string
  cpaCommit?: string
  cpaBuildDate?: string
  homeVersion?: string
  homeCommit?: string
  homeBuildDate?: string
}

export type CapabilityProbeResult = {
  capabilities: CapabilityMap
  runtimeMode: RuntimeMode
  serverInfo: ManagementServerInfo
  probedAt: string
}

export type ManagementSessionInput = {
  baseUrl: string
  managementKey: string
}

export type ManagementApiError = {
  message: string
  status?: number
  code?: 'network' | 'auth' | 'not-found' | 'server' | 'unknown'
  backendCode?: string
  requestId?: string
  retryable?: boolean
}
