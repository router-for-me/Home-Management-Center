import type { DashboardSnapshot } from '@/lib/api/management/dashboard'
import type { CapabilityMap, RuntimeMode } from '@/lib/api/management/types'

type DashboardConfigCheckId = 'requestLog' | 'usageStatistics' | 'fileLogging' | 'debug' | 'routing'

type DashboardCapabilityId = 'nodes' | 'usage' | 'usageQueue' | 'logs' | 'requestErrorLogs'

export type DashboardTone = 'neutral' | 'positive' | 'info' | 'warning'

export type DashboardHealthSummary = {
  id: 'ready' | 'needsModelService' | 'needsCredential' | 'needsClientKey' | 'limited' | 'degraded'
  tone: DashboardTone
}

export type DashboardRecommendedAction = {
  id:
    | 'configureProviders'
    | 'addCredential'
    | 'createClientKey'
    | 'checkRouting'
    | 'reviewDebug'
    | 'reviewDataStatus'
  to: '/providers' | '/credentials' | '/access-keys' | '/config' | '/system-nodes'
  tone: DashboardTone
}

export type DashboardMetric = {
  id: 'providers' | 'credentials' | 'clientKeys' | 'nodes'
  value: number | null
  detailValue?: number | string
  tone: DashboardTone
}

export type DashboardConfigCheck = {
  id: DashboardConfigCheckId
  enabled: boolean
  value: string
  tone: DashboardTone
}

export type DashboardCapabilityStatus = {
  id: DashboardCapabilityId
  available: boolean
}

export type DashboardDataStatusItem = {
  id: string
  labelKey: string
  kind: 'requestIssue' | 'unavailableCapability'
  status?: number
}

export type DashboardProviderRow = {
  id: string
  total: number
  active: number
  disabled: number
  route: string
}

export type DashboardOverviewViewModel = {
  healthSummary: DashboardHealthSummary
  recommendedActions: DashboardRecommendedAction[]
  runtimeMode: RuntimeMode
  fetchedAt: string
  latestVersion: string | null
  metrics: DashboardMetric[]
  configChecks: DashboardConfigCheck[]
  capabilities: DashboardCapabilityStatus[]
  dataStatusItems: DashboardDataStatusItem[]
  providerRows: DashboardProviderRow[]
  allProvidersEmpty: boolean
  credentialSources: Array<{
    source: string
    total: number
  }>
  issueCount: number
}

function readBoolean(config: Record<string, unknown>, key: string): boolean {
  return config[key] === true
}

function readRoutingStrategy(config: Record<string, unknown>): string {
  const routing = config.routing

  if (typeof routing !== 'object' || routing === null || Array.isArray(routing)) {
    return 'unknown'
  }

  const strategy = (routing as Record<string, unknown>).strategy
  if (typeof strategy !== 'string') return 'unknown'

  const normalizedStrategy = strategy.trim()
  return normalizedStrategy && normalizedStrategy.toLowerCase() !== 'unknown'
    ? normalizedStrategy
    : 'unknown'
}

function createHealthSummary({
  activeProviders,
  activeCredentials,
  clientKeys,
  issueCount,
  unavailableCapabilityCount,
  debugEnabled,
  routingStrategy,
}: {
  activeProviders: number
  activeCredentials: number
  clientKeys: number
  issueCount: number
  unavailableCapabilityCount: number
  debugEnabled: boolean
  routingStrategy: string
}): DashboardHealthSummary {
  if (activeProviders === 0) {
    return { id: 'needsModelService', tone: 'warning' }
  }

  if (activeCredentials === 0) {
    return { id: 'needsCredential', tone: 'warning' }
  }

  if (clientKeys === 0) {
    return { id: 'needsClientKey', tone: 'warning' }
  }

  if (issueCount > 0 || debugEnabled || routingStrategy === 'unknown') {
    return { id: 'degraded', tone: 'warning' }
  }

  if (unavailableCapabilityCount > 0) {
    return { id: 'limited', tone: 'info' }
  }

  return { id: 'ready', tone: 'positive' }
}

function createRecommendedActions({
  activeProviders,
  activeCredentials,
  clientKeys,
  routingStrategy,
  debugEnabled,
  dataStatusCount,
}: {
  activeProviders: number
  activeCredentials: number
  clientKeys: number
  routingStrategy: string
  debugEnabled: boolean
  dataStatusCount: number
}): DashboardRecommendedAction[] {
  const actions: DashboardRecommendedAction[] = []

  if (activeProviders === 0) {
    actions.push({ id: 'configureProviders', to: '/providers', tone: 'warning' })
  }

  if (activeCredentials === 0) {
    actions.push({ id: 'addCredential', to: '/credentials', tone: 'warning' })
  }

  if (clientKeys === 0) {
    actions.push({ id: 'createClientKey', to: '/access-keys', tone: 'warning' })
  }

  if (routingStrategy === 'unknown') {
    actions.push({ id: 'checkRouting', to: '/config', tone: 'warning' })
  }

  if (debugEnabled) {
    actions.push({ id: 'reviewDebug', to: '/config', tone: 'warning' })
  }

  if (dataStatusCount > 0) {
    actions.push({ id: 'reviewDataStatus', to: '/system-nodes', tone: 'neutral' })
  }

  return actions.slice(0, 3)
}

function countCredentialSources(authFiles: DashboardSnapshot['authFiles']) {
  const counts = authFiles.reduce<Record<string, number>>((nextCounts, authFile) => {
    const source = authFile.source || 'unknown'
    return {
      ...nextCounts,
      [source]: (nextCounts[source] ?? 0) + 1,
    }
  }, {})

  return Object.entries(counts)
    .map(([source, total]) => ({ source, total }))
    .sort((left, right) => right.total - left.total)
}

export function createDashboardOverviewViewModel(
  snapshot: DashboardSnapshot,
  capabilities: CapabilityMap,
  runtimeMode: RuntimeMode,
): DashboardOverviewViewModel {
  const activeProviders = snapshot.providers.reduce((total, provider) => total + provider.active, 0)
  const providerFamilies = snapshot.providers.filter((provider) => provider.total > 0).length
  const activeCredentials = snapshot.authFiles.filter(
    (authFile) => !authFile.disabled && !authFile.unavailable,
  ).length
  const routingStrategy = readRoutingStrategy(snapshot.config)
  const debugEnabled = readBoolean(snapshot.config, 'debug')
  const metrics: DashboardMetric[] = [
    {
      id: 'providers',
      value: activeProviders,
      detailValue: providerFamilies,
      tone: activeProviders > 0 ? 'positive' : 'warning',
    },
    {
      id: 'credentials',
      value: activeCredentials,
      detailValue: snapshot.authFiles.length,
      tone: activeCredentials > 0 ? 'positive' : 'warning',
    },
    {
      id: 'clientKeys',
      value: snapshot.clientKeys.length,
      tone: snapshot.clientKeys.length > 0 ? 'positive' : 'warning',
    },
  ]

  if (capabilities.nodes) {
    metrics.push({
      id: 'nodes',
      value: snapshot.nodes.length,
      tone: 'neutral',
    })
  }
  const capabilityStatuses: DashboardCapabilityStatus[] = [
    { id: 'nodes', available: capabilities.nodes },
    { id: 'usage', available: capabilities.usage },
    { id: 'usageQueue', available: capabilities.usageQueue },
    { id: 'logs', available: capabilities.logs },
    { id: 'requestErrorLogs', available: capabilities.requestErrorLogs },
  ]
  const unavailableCapabilityStatuses = capabilityStatuses.filter(
    (capability) => !capability.available,
  )
  const dataStatusItems: DashboardDataStatusItem[] = [
    ...snapshot.issues.map((issue) => ({
      id: `issue-${issue.scope}`,
      labelKey: `dashboard.issueScopes.${issue.scope}`,
      kind: 'requestIssue' as const,
      status: issue.status,
    })),
    ...unavailableCapabilityStatuses.map((capability) => ({
      id: `capability-${capability.id}`,
      labelKey: `dashboard.capabilityNames.${capability.id}`,
      kind: 'unavailableCapability' as const,
    })),
  ]
  const allProvidersEmpty = snapshot.providers.every((provider) => provider.total === 0)
  const healthSummary = createHealthSummary({
    activeProviders,
    activeCredentials,
    clientKeys: snapshot.clientKeys.length,
    issueCount: snapshot.issues.length,
    unavailableCapabilityCount: unavailableCapabilityStatuses.length,
    debugEnabled,
    routingStrategy,
  })
  const recommendedActions = createRecommendedActions({
    activeProviders,
    activeCredentials,
    clientKeys: snapshot.clientKeys.length,
    routingStrategy,
    debugEnabled,
    dataStatusCount: dataStatusItems.length,
  })

  return {
    healthSummary,
    recommendedActions,
    runtimeMode,
    fetchedAt: snapshot.fetchedAt,
    latestVersion: snapshot.latestVersion,
    metrics,
    configChecks: [
      {
        id: 'requestLog',
        enabled: readBoolean(snapshot.config, 'request-log'),
        value: readBoolean(snapshot.config, 'request-log') ? 'enabled' : 'disabled',
        tone: readBoolean(snapshot.config, 'request-log') ? 'positive' : 'warning',
      },
      {
        id: 'usageStatistics',
        enabled: readBoolean(snapshot.config, 'usage-statistics-enabled'),
        value: readBoolean(snapshot.config, 'usage-statistics-enabled') ? 'enabled' : 'disabled',
        tone: readBoolean(snapshot.config, 'usage-statistics-enabled') ? 'positive' : 'warning',
      },
      {
        id: 'fileLogging',
        enabled: readBoolean(snapshot.config, 'logging-to-file'),
        value: readBoolean(snapshot.config, 'logging-to-file') ? 'enabled' : 'disabled',
        tone: readBoolean(snapshot.config, 'logging-to-file') ? 'positive' : 'neutral',
      },
      {
        id: 'debug',
        enabled: debugEnabled,
        value: debugEnabled ? 'enabled' : 'disabled',
        tone: debugEnabled ? 'warning' : 'positive',
      },
      {
        id: 'routing',
        enabled: routingStrategy !== 'unknown',
        value: routingStrategy,
        tone: routingStrategy !== 'unknown' ? 'positive' : 'warning',
      },
    ],
    capabilities: capabilityStatuses.filter((capability) => capability.available),
    dataStatusItems,
    providerRows: snapshot.providers.map((provider) => ({
      id: provider.id,
      total: provider.total,
      active: provider.active,
      disabled: provider.disabled,
      route: provider.path,
    })),
    allProvidersEmpty,
    credentialSources: countCredentialSources(snapshot.authFiles),
    issueCount: snapshot.issues.length,
  }
}
