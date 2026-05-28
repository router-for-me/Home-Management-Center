import type { CapabilityMap } from '@/lib/api/management/types'
import type {
  ApiKeyUsageResource,
  RequestErrorLogFile,
  RuntimeLogSnapshot,
  UsageAnalyticsOverview,
  UsageLogIssue,
  UsageRuntimeSettings,
} from '@/lib/api/management/usage-logs'

export type UsageAnalyticsDimension =
  | 'time'
  | 'provider'
  | 'model'
  | 'endpoint'
  | 'user'
  | 'account'
  | 'clientKey'
  | 'providerKey'
  | 'credential'
  | 'cost'
  | 'latency'

export type UsageAnalyticsVerdict =
  | 'ready'
  | 'idle'
  | 'disabled'
  | 'partial'
  | 'limited'
  | 'unsupported'

export type UsageProviderBreakdown = {
  provider: string
  success: number
  failed: number
  total: number
  recentRequestCount: number
  keyCount: number
}

export type UsageOverviewMetric = {
  id:
    | 'requests'
    | 'failureRate'
    | 'resources'
    | 'recentWindows'
    | 'totalTokens'
    | 'estimatedCost'
    | 'rpm'
    | 'tpm'
  value: string
  detail: string
  tone: 'positive' | 'warning' | 'neutral'
}

export type UsageAnalyticsModel = {
  verdict: UsageAnalyticsVerdict
  totals: {
    success: number
    failed: number
    requests: number
    recentRequestCount: number
    usageResources: number
    logLineCount: number
    errorLogFiles: number
    totalTokens: number
    estimatedCostUsd: number
    unpricedRecords: number
    rpm: number | null
    tpm: number | null
  }
  failureRate: number
  providerBreakdown: UsageProviderBreakdown[]
  metrics: UsageOverviewMetric[]
  currentDimensions: UsageAnalyticsDimension[]
  plannedDimensions: UsageAnalyticsDimension[]
}

function formatCount(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value)
}

function getVerdict({
  capabilities,
  issues,
  requests,
  settings,
}: {
  capabilities: CapabilityMap
  issues: UsageLogIssue[]
  requests: number
  settings: UsageRuntimeSettings
}): UsageAnalyticsVerdict {
  if (
    !capabilities.usageAnalytics &&
    !capabilities.usage &&
    !capabilities.logs &&
    !capabilities.requestErrorLogs
  ) {
    return 'unsupported'
  }

  if (issues.length > 0) {
    return 'partial'
  }

  if (capabilities.usageAnalytics) {
    return requests > 0 ? 'ready' : 'idle'
  }

  if (!capabilities.usage) {
    return 'limited'
  }

  if (!settings.usageStatisticsEnabled) {
    return 'disabled'
  }

  return requests > 0 ? 'ready' : 'idle'
}

function getProviderBreakdown(resources: ApiKeyUsageResource[]) {
  const grouped = new Map<string, UsageProviderBreakdown>()

  for (const resource of resources) {
    const current = grouped.get(resource.provider) ?? {
      provider: resource.provider,
      success: 0,
      failed: 0,
      total: 0,
      recentRequestCount: 0,
      keyCount: 0,
    }

    current.success += resource.success
    current.failed += resource.failed
    current.total += resource.success + resource.failed
    current.recentRequestCount += resource.recentRequestCount
    current.keyCount += 1
    grouped.set(resource.provider, current)
  }

  return [...grouped.values()].sort((left, right) => right.total - left.total)
}

function getProviderBreakdownFromOverview(overview: UsageAnalyticsOverview) {
  return overview.distributions.providers
    .map((item) => ({
      provider: item.label || item.key,
      success: Math.max(item.records - item.failedRecords, 0),
      failed: item.failedRecords,
      total: item.records,
      recentRequestCount: 0,
      keyCount: 0,
    }))
    .sort((left, right) => right.total - left.total)
}

export function createUsageAnalyticsModel({
  overview,
  usage,
  runtimeLogs,
  requestErrorLogs,
  issues,
  capabilities,
  settings,
}: {
  overview: UsageAnalyticsOverview | null
  usage: ApiKeyUsageResource[]
  runtimeLogs: RuntimeLogSnapshot | null
  requestErrorLogs: RequestErrorLogFile[]
  issues: UsageLogIssue[]
  capabilities: CapabilityMap
  settings: UsageRuntimeSettings
}): UsageAnalyticsModel {
  const success = overview
    ? overview.summary.successRecords
    : usage.reduce((total, item) => total + item.success, 0)
  const failed = overview
    ? overview.summary.failedRecords
    : usage.reduce((total, item) => total + item.failed, 0)
  const requests = success + failed
  const recentRequestCount = usage.reduce((total, item) => total + item.recentRequestCount, 0)
  const failureRate =
    overview?.summary.failureRate ?? (requests > 0 ? (failed / requests) * 100 : 0)
  const providerBreakdown = overview
    ? getProviderBreakdownFromOverview(overview)
    : getProviderBreakdown(usage)
  const currentDimensions: UsageAnalyticsDimension[] = []

  if (capabilities.usageAnalytics) {
    currentDimensions.push('time', 'user', 'clientKey', 'model', 'cost')
  } else if (capabilities.usage) {
    currentDimensions.push('providerKey')
  }

  if (providerBreakdown.length > 0 && !currentDimensions.includes('provider')) {
    currentDimensions.push('provider')
  }

  if (overview?.distributions.endpoints.length) {
    currentDimensions.push('endpoint')
  }

  const totalTokens = overview?.summary.totalTokens ?? 0
  const estimatedCostUsd = overview?.summary.estimatedCostUsd ?? 0
  const unpricedRecords = overview?.summary.unpricedRecords ?? 0
  const rpm = overview?.summary.rpm ?? null
  const tpm = overview?.summary.tpm ?? null
  const plannedDimensions: UsageAnalyticsDimension[] = capabilities.usageAnalytics
    ? ['account', 'credential', 'latency']
    : ['time', 'model', 'endpoint', 'user', 'account', 'clientKey', 'credential', 'cost', 'latency']

  return {
    verdict: getVerdict({ capabilities, issues, requests, settings }),
    totals: {
      success,
      failed,
      requests,
      recentRequestCount,
      usageResources: usage.length,
      logLineCount: runtimeLogs?.lineCount ?? 0,
      errorLogFiles: requestErrorLogs.length,
      totalTokens,
      estimatedCostUsd,
      unpricedRecords,
      rpm,
      tpm,
    },
    failureRate,
    providerBreakdown,
    currentDimensions,
    plannedDimensions,
    metrics: [
      {
        id: 'requests',
        value: formatCount(requests),
        detail: `${formatCount(success)} / ${formatCount(failed)}`,
        tone: failed > 0 ? 'warning' : requests > 0 ? 'positive' : 'neutral',
      },
      {
        id: 'failureRate',
        value: `${formatPercent(failureRate)}%`,
        detail: `${formatCount(failed)} / ${formatCount(requests)}`,
        tone: requests > 0 ? (failureRate > 0 ? 'warning' : 'positive') : 'neutral',
      },
      ...(overview
        ? [
            {
              id: 'totalTokens' as const,
              value: formatCount(totalTokens),
              detail: `${formatCount(overview.summary.inputTokens)} / ${formatCount(
                overview.summary.outputTokens,
              )}`,
              tone: totalTokens > 0 ? ('positive' as const) : ('neutral' as const),
            },
            {
              id: 'estimatedCost' as const,
              value: formatCurrency(estimatedCostUsd),
              detail: formatCount(unpricedRecords),
              tone: unpricedRecords > 0 ? ('warning' as const) : ('neutral' as const),
            },
            {
              id: 'rpm' as const,
              value: rpm === null ? '-' : formatCount(rpm),
              detail: rpm === null ? '-' : formatCount(rpm),
              tone: rpm && rpm > 0 ? ('positive' as const) : ('neutral' as const),
            },
            {
              id: 'tpm' as const,
              value: tpm === null ? '-' : formatCount(tpm),
              detail: tpm === null ? '-' : formatCount(tpm),
              tone: tpm && tpm > 0 ? ('positive' as const) : ('neutral' as const),
            },
          ]
        : [
            {
              id: 'resources' as const,
              value: formatCount(usage.length),
              detail: formatCount(providerBreakdown.length),
              tone: usage.length > 0 ? ('positive' as const) : ('neutral' as const),
            },
            {
              id: 'recentWindows' as const,
              value: formatCount(recentRequestCount),
              detail: formatCount(requestErrorLogs.length),
              tone: requestErrorLogs.length > 0 ? ('warning' as const) : ('neutral' as const),
            },
          ]),
    ],
  }
}
