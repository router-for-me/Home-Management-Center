import {
  formatClientKeyIdentityLabel,
  formatClientKeyRankLabel,
} from '@/features/access-keys/access-key-display'
import type { AccessKeyResource } from '@/lib/api/management/access-keys'
import type { DashboardSnapshot } from '@/lib/api/management/dashboard'
import { readManagementRoutingStrategy } from '@/lib/api/management/routing'
import type { CapabilityMap, RuntimeMode } from '@/lib/api/management/types'
import type { UsageActivityStatus, UsageAggregateItem } from '@/lib/api/management/usage-logs'
import type { UserResource } from '@/lib/api/management/users'

type DashboardConfigCheckId = 'requestLog' | 'usageStatistics' | 'fileLogging' | 'debug' | 'routing'

type DashboardCapabilityId =
  | 'nodes'
  | 'usage'
  | 'logs'
  | 'requestErrorLogs'
  | 'users'
  | 'accessGroups'

export type DashboardTone = 'neutral' | 'positive' | 'info' | 'warning'

export type DashboardHealthSummary = {
  id:
    | 'ready'
    | 'modelStatusUnknown'
    | 'needsUpstreamAccess'
    | 'reviewUpstreamAccess'
    | 'needsClientKey'
    | 'limited'
    | 'degraded'
  tone: DashboardTone
}

export type DashboardRecommendedAction = {
  id:
    | 'configureProviders'
    | 'addCredential'
    | 'reviewModelServices'
    | 'reviewCredentials'
    | 'createClientKey'
    | 'checkRouting'
    | 'reviewDebug'
    | 'reviewDataStatus'
  to:
    | '/admin/providers'
    | '/admin/credentials'
    | '/admin/access-keys'
    | '/admin/config'
    | '/admin/system-nodes'
  tone: DashboardTone
}

export type DashboardMetric = {
  id: 'providers' | 'credentials' | 'clientKeys' | 'nodes'
  value: number | null
  detailValue?: number | string
  detailKey?: string
  tone: DashboardTone
}

export type DashboardOperatingKpi = {
  id: 'tokens' | 'requests' | 'successRate' | 'activeClientKeys'
  value: number | null
  detailValue?: number | null
  tone: DashboardTone
  format: 'compact' | 'number' | 'percent'
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
  tone: DashboardTone
}

export type DashboardDataStatusItem = {
  id: string
  labelKey: string
  kind: 'requestIssue' | 'unavailableCapability'
  tone: DashboardTone
  status?: number
}

export type DashboardProviderRow = {
  id: string
  total: number
  active: number
  disabled: number
  route: string
}

export type DashboardUsageActivitySummary = {
  requestCount: number
  successRate: number
  errorRate: number
  activeBucketCount: number
  bucketCount: number
  rangeFrom: string
  rangeTo: string
  timezone: string
  interval: string
  buckets: Array<{
    id: string
    label: string
    requestCount: number
    successRate: number
    status: UsageActivityStatus
  }>
}

export type DashboardUsageConsumptionTrendSummary = {
  totalTokens: number
  bucketCount: number
  activeBucketCount: number
  points: Array<{
    id: string
    label: string
    tokens: number
    requestCount: number
  }>
}

export type DashboardRankPreviewItem = {
  id: string
  label: string
  requestCount: number
  totalTokens: number | null
  successRate: number
  failedCount: number
  lastUsedAt: string | null
  tone: DashboardTone
}

export type DashboardKeyStatusSummary = {
  totalConfigured: number
  activeCount: number | null
  quietCount: number | null
  topClientKeys: DashboardRankPreviewItem[]
}

export type DashboardModelUsageSummary = {
  activeCount: number | null
  topModels: DashboardRankPreviewItem[]
}

export type DashboardOverviewViewModel = {
  healthSummary: DashboardHealthSummary
  recommendedActions: DashboardRecommendedAction[]
  runtimeMode: RuntimeMode
  fetchedAt: string
  latestVersion: string | null
  operatingKpis: DashboardOperatingKpi[]
  metrics: DashboardMetric[]
  configChecks: DashboardConfigCheck[]
  capabilities: DashboardCapabilityStatus[]
  dataStatusItems: DashboardDataStatusItem[]
  providerRows: DashboardProviderRow[]
  usageConsumptionTrendSummary: DashboardUsageConsumptionTrendSummary | null
  usageActivitySummary: DashboardUsageActivitySummary | null
  keyStatusSummary: DashboardKeyStatusSummary
  modelUsageSummary: DashboardModelUsageSummary
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

function getDashboardCapabilityTone(id: DashboardCapabilityId): DashboardTone {
  if (id === 'users' || id === 'accessGroups') return 'warning'
  return 'info'
}

function createHealthSummary({
  availableModels,
  activeProviders,
  activeCredentials,
  clientKeys,
  issueCount,
  unavailableCapabilityCount,
  unavailableWarningCapabilityCount,
  debugEnabled,
  routingStrategy,
}: {
  availableModels: DashboardSnapshot['availableModels']
  activeProviders: number
  activeCredentials: number
  clientKeys: number
  issueCount: number
  unavailableCapabilityCount: number
  unavailableWarningCapabilityCount: number
  debugEnabled: boolean
  routingStrategy: string
}): DashboardHealthSummary {
  if (availableModels.status === 'error') {
    return { id: 'modelStatusUnknown', tone: 'warning' }
  }

  if (availableModels.count === 0) {
    if (activeProviders === 0 && activeCredentials === 0) {
      return { id: 'needsUpstreamAccess', tone: 'warning' }
    }

    return { id: 'reviewUpstreamAccess', tone: 'warning' }
  }

  if (clientKeys === 0) {
    return { id: 'needsClientKey', tone: 'warning' }
  }

  if (issueCount > 0 || debugEnabled || routingStrategy === 'unknown') {
    return { id: 'degraded', tone: 'warning' }
  }

  if (unavailableWarningCapabilityCount > 0) {
    return { id: 'limited', tone: 'warning' }
  }

  if (unavailableCapabilityCount > 0) {
    return { id: 'limited', tone: 'info' }
  }

  return { id: 'ready', tone: 'positive' }
}

function createRecommendedActions({
  availableModels,
  activeProviders,
  activeCredentials,
  clientKeys,
  routingStrategy,
  debugEnabled,
  dataStatusCount,
}: {
  availableModels: DashboardSnapshot['availableModels']
  activeProviders: number
  activeCredentials: number
  clientKeys: number
  routingStrategy: string
  debugEnabled: boolean
  dataStatusCount: number
}): DashboardRecommendedAction[] {
  const actions: DashboardRecommendedAction[] = []

  const addAction = (action: DashboardRecommendedAction) => {
    if (actions.some((item) => item.id === action.id)) return
    actions.push(action)
  }

  if (availableModels.status === 'error') {
    addAction({ id: 'reviewDataStatus', to: '/admin/system-nodes', tone: 'neutral' })
  } else if (availableModels.count === 0) {
    if (activeProviders === 0 && activeCredentials === 0) {
      addAction({ id: 'addCredential', to: '/admin/credentials', tone: 'warning' })
      addAction({ id: 'configureProviders', to: '/admin/providers', tone: 'warning' })
    } else {
      if (activeCredentials > 0) {
        addAction({ id: 'reviewCredentials', to: '/admin/credentials', tone: 'warning' })
      }
      if (activeProviders > 0) {
        addAction({ id: 'reviewModelServices', to: '/admin/providers', tone: 'warning' })
      }
    }
  }

  if (clientKeys === 0) {
    addAction({ id: 'createClientKey', to: '/admin/access-keys', tone: 'warning' })
  }

  if (routingStrategy === 'unknown') {
    addAction({ id: 'checkRouting', to: '/admin/config', tone: 'warning' })
  }

  if (debugEnabled) {
    addAction({ id: 'reviewDebug', to: '/admin/config', tone: 'warning' })
  }

  if (dataStatusCount > 0) {
    addAction({ id: 'reviewDataStatus', to: '/admin/system-nodes', tone: 'neutral' })
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

function aggregateTone(item: Pick<UsageAggregateItem, 'failedCount' | 'errorRate'>): DashboardTone {
  if (item.failedCount > 0 || item.errorRate >= 0.05) return 'warning'
  return 'positive'
}

export { formatClientKeyIdentityLabel, formatClientKeyRankLabel }

function createRankPreviewItems(
  items: UsageAggregateItem[] | undefined,
  formatLabel?: (item: UsageAggregateItem) => string,
): DashboardRankPreviewItem[] {
  return (items ?? []).slice(0, 3).map((item) => ({
    id: item.id,
    label: formatLabel ? formatLabel(item) : item.label,
    requestCount: item.requestCount,
    totalTokens: item.tokenBreakdown?.totalTokens ?? null,
    successRate: item.successRate,
    failedCount: item.failedCount,
    lastUsedAt: item.lastUsedAt,
    tone: aggregateTone(item),
  }))
}

function createOperatingKpis(
  usageOverview: DashboardSnapshot['usageOverview'],
): DashboardOperatingKpi[] {
  const totals = usageOverview?.totals
  const totalTokens = totals?.tokenBreakdown?.totalTokens ?? null

  return [
    {
      id: 'tokens',
      value: totalTokens,
      detailValue: totals?.activeModelCount ?? null,
      tone: totalTokens !== null && totalTokens > 0 ? 'positive' : 'neutral',
      format: 'compact',
    },
    {
      id: 'requests',
      value: totals?.requestCount ?? null,
      detailValue: totals?.failedCount ?? null,
      tone: totals && totals.failedCount > 0 ? 'warning' : totals ? 'positive' : 'neutral',
      format: 'number',
    },
    {
      id: 'successRate',
      value: totals?.successRate ?? null,
      detailValue: totals?.errorRate ?? null,
      tone:
        totals && totals.successRate >= 0.98
          ? 'positive'
          : totals && totals.successRate >= 0.95
            ? 'info'
            : totals
              ? 'warning'
              : 'neutral',
      format: 'percent',
    },
    {
      id: 'activeClientKeys',
      value: totals?.activeClientKeyCount ?? null,
      detailValue: totals?.activeCredentialCount ?? null,
      tone: totals && totals.activeClientKeyCount > 0 ? 'positive' : totals ? 'warning' : 'neutral',
      format: 'number',
    },
  ]
}

function createKeyStatusSummary(
  usageOverview: DashboardSnapshot['usageOverview'],
  totalConfigured: number,
  accessKeys?: AccessKeyResource[],
  users?: UserResource[],
): DashboardKeyStatusSummary {
  const activeCount = usageOverview?.totals.activeClientKeyCount ?? null
  const quietCount = activeCount === null ? null : Math.max(0, totalConfigured - activeCount)

  return {
    totalConfigured,
    activeCount,
    quietCount,
    topClientKeys: createRankPreviewItems(usageOverview?.top.clientKeys, (item) =>
      formatClientKeyRankLabel(item, accessKeys, users),
    ),
  }
}

function createModelUsageSummary(
  usageOverview: DashboardSnapshot['usageOverview'],
): DashboardModelUsageSummary {
  return {
    activeCount: usageOverview?.totals.activeModelCount ?? null,
    topModels: createRankPreviewItems(usageOverview?.top.models),
  }
}

function createUsageConsumptionTrendSummary(
  usageOverview: DashboardSnapshot['usageOverview'],
): DashboardUsageConsumptionTrendSummary | null {
  const buckets = usageOverview?.trend ?? []
  if (buckets.length === 0 || !usageOverview) return null
  const totalTokens = usageOverview.totals.tokenBreakdown?.totalTokens
  const bucketBreakdowns = buckets.map((bucket) => bucket.tokenBreakdown)
  if (totalTokens === undefined || bucketBreakdowns.some((breakdown) => breakdown === null)) {
    return null
  }

  return {
    totalTokens,
    bucketCount: buckets.length,
    activeBucketCount: bucketBreakdowns.filter((breakdown) => (breakdown?.totalTokens ?? 0) > 0)
      .length,
    points: buckets.map((bucket, index) => ({
      id: `${bucket.bucketStart}:${bucket.bucketEnd}`,
      label: `${bucket.bucketStart} - ${bucket.bucketEnd}`,
      tokens: bucketBreakdowns[index]?.totalTokens ?? 0,
      requestCount: bucket.requestCount,
    })),
  }
}

function createUsageActivitySummary(
  usageOverview: DashboardSnapshot['usageOverview'],
): DashboardUsageActivitySummary | null {
  const buckets = usageOverview?.activity ?? []
  if (buckets.length === 0 || !usageOverview) return null
  const requestCount = buckets.reduce((total, bucket) => total + bucket.requestCount, 0)
  const successCount = buckets.reduce((total, bucket) => total + bucket.successCount, 0)
  const failedCount = buckets.reduce((total, bucket) => total + bucket.failedCount, 0)

  return {
    requestCount,
    successRate: requestCount > 0 ? successCount / requestCount : 0,
    errorRate: requestCount > 0 ? failedCount / requestCount : 0,
    activeBucketCount: buckets.filter((bucket) => bucket.requestCount > 0).length,
    bucketCount: buckets.length,
    rangeFrom: usageOverview.range.from ?? buckets[0]?.bucketStart ?? '',
    rangeTo: usageOverview.range.to ?? buckets.at(-1)?.bucketEnd ?? '',
    timezone: usageOverview.range.timezone,
    interval: usageOverview.range.interval,
    buckets: buckets.map((bucket) => ({
      id: `${bucket.bucketStart}:${bucket.bucketEnd}`,
      label: `${bucket.bucketStart} - ${bucket.bucketEnd}`,
      requestCount: bucket.requestCount,
      successRate: bucket.successRate,
      status: bucket.status,
    })),
  }
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
  const hasAvailableModels =
    snapshot.availableModels.status === 'loaded' && snapshot.availableModels.count > 0
  const missingAvailableModels =
    snapshot.availableModels.status === 'loaded' && snapshot.availableModels.count === 0
  const inventoryTone = (count: number): DashboardTone => {
    if (count > 0) return 'positive'
    if (hasAvailableModels) return 'neutral'
    if (missingAvailableModels) return 'warning'
    return 'neutral'
  }
  const routingStrategy = readManagementRoutingStrategy(snapshot.config)
  const debugEnabled = readBoolean(snapshot.config, 'debug')
  const nodeTopologySupported = capabilities.topology || capabilities.nodes
  const nodeCount = snapshot.nodeTopology?.cpaCount ?? snapshot.nodes.length
  const homeNodeCount = snapshot.nodeTopology?.homeCount ?? 0
  const metrics: DashboardMetric[] = [
    {
      id: 'providers',
      value: activeProviders,
      detailValue: providerFamilies,
      tone: inventoryTone(activeProviders),
    },
    {
      id: 'credentials',
      value: activeCredentials,
      detailValue: snapshot.authFiles.length,
      tone: inventoryTone(activeCredentials),
    },
    {
      id: 'clientKeys',
      value: snapshot.clientKeys.length,
      tone: snapshot.clientKeys.length > 0 ? 'positive' : 'warning',
    },
  ]

  if (nodeTopologySupported) {
    metrics.push({
      id: 'nodes',
      value: nodeCount,
      detailValue: homeNodeCount > 0 ? homeNodeCount : nodeCount,
      detailKey: homeNodeCount > 0 ? 'dashboard.metrics.nodes.clusterDetail' : undefined,
      tone: nodeCount > 0 ? 'positive' : 'warning',
    })
  }
  const capabilityStatuses: DashboardCapabilityStatus[] = [
    { id: 'nodes', available: nodeTopologySupported, tone: getDashboardCapabilityTone('nodes') },
    { id: 'usage', available: capabilities.usage, tone: getDashboardCapabilityTone('usage') },
    { id: 'logs', available: capabilities.logs, tone: getDashboardCapabilityTone('logs') },
    {
      id: 'requestErrorLogs',
      available: capabilities.requestErrorLogs,
      tone: getDashboardCapabilityTone('requestErrorLogs'),
    },
    { id: 'users', available: capabilities.users, tone: getDashboardCapabilityTone('users') },
    {
      id: 'accessGroups',
      available: capabilities.accessGroups,
      tone: getDashboardCapabilityTone('accessGroups'),
    },
  ]
  const unavailableCapabilityStatuses = capabilityStatuses.filter(
    (capability) => !capability.available,
  )
  const unavailableWarningCapabilityCount = unavailableCapabilityStatuses.filter(
    (capability) => capability.tone === 'warning',
  ).length
  const dataStatusItems: DashboardDataStatusItem[] = [
    ...snapshot.issues.map((issue) => ({
      id: `issue-${issue.scope}`,
      labelKey: `dashboard.issueScopes.${issue.scope}`,
      kind: 'requestIssue' as const,
      tone: 'warning' as const,
      status: issue.status,
    })),
    ...unavailableCapabilityStatuses.map((capability) => ({
      id: `capability-${capability.id}`,
      labelKey: `dashboard.capabilityNames.${capability.id}`,
      kind: 'unavailableCapability' as const,
      tone: capability.tone,
    })),
  ]
  const allProvidersEmpty = snapshot.providers.every((provider) => provider.total === 0)
  const operatingKpis = createOperatingKpis(snapshot.usageOverview)
  const usageConsumptionTrendSummary = createUsageConsumptionTrendSummary(snapshot.usageOverview)
  const usageActivitySummary = createUsageActivitySummary(snapshot.usageOverview)
  const keyStatusSummary = createKeyStatusSummary(
    snapshot.usageOverview,
    snapshot.clientKeys.length,
    snapshot.accessKeys,
    snapshot.users,
  )
  const modelUsageSummary = createModelUsageSummary(snapshot.usageOverview)
  const healthSummary = createHealthSummary({
    availableModels: snapshot.availableModels,
    activeProviders,
    activeCredentials,
    clientKeys: snapshot.clientKeys.length,
    issueCount: snapshot.issues.length,
    unavailableCapabilityCount: unavailableCapabilityStatuses.length,
    unavailableWarningCapabilityCount,
    debugEnabled,
    routingStrategy,
  })
  const recommendedActions = createRecommendedActions({
    availableModels: snapshot.availableModels,
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
    operatingKpis,
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
    capabilities: unavailableCapabilityStatuses,
    dataStatusItems,
    providerRows: snapshot.providers.map((provider) => ({
      id: provider.id,
      total: provider.total,
      active: provider.active,
      disabled: provider.disabled,
      route: provider.path,
    })),
    usageConsumptionTrendSummary,
    usageActivitySummary,
    keyStatusSummary,
    modelUsageSummary,
    allProvidersEmpty,
    credentialSources: countCredentialSources(snapshot.authFiles),
    issueCount: snapshot.issues.length,
  }
}
