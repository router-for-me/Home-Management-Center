import type { CapabilityMap } from '@/lib/api/management/types'
import type {
  ApiKeyUsageResource,
  RequestErrorLogFile,
  RuntimeLogSnapshot,
  UsageLogIssue,
  UsageRuntimeSettings,
} from '@/lib/api/management/usage-logs'

export type UsageAnalyticsDimension =
  | 'time'
  | 'provider'
  | 'model'
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
  id: 'requests' | 'failureRate' | 'resources' | 'recentWindows'
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
  if (!capabilities.usage && !capabilities.logs && !capabilities.requestErrorLogs) {
    return 'unsupported'
  }

  if (!capabilities.usage) {
    return 'limited'
  }

  if (!settings.usageStatisticsEnabled) {
    return 'disabled'
  }

  if (issues.length > 0) {
    return 'partial'
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

export function createUsageAnalyticsModel({
  usage,
  runtimeLogs,
  requestErrorLogs,
  issues,
  capabilities,
  settings,
}: {
  usage: ApiKeyUsageResource[]
  runtimeLogs: RuntimeLogSnapshot | null
  requestErrorLogs: RequestErrorLogFile[]
  issues: UsageLogIssue[]
  capabilities: CapabilityMap
  settings: UsageRuntimeSettings
}): UsageAnalyticsModel {
  const success = usage.reduce((total, item) => total + item.success, 0)
  const failed = usage.reduce((total, item) => total + item.failed, 0)
  const requests = success + failed
  const recentRequestCount = usage.reduce((total, item) => total + item.recentRequestCount, 0)
  const failureRate = requests > 0 ? (failed / requests) * 100 : 0
  const providerBreakdown = getProviderBreakdown(usage)
  const currentDimensions: UsageAnalyticsDimension[] = capabilities.usage ? ['providerKey'] : []

  if (providerBreakdown.length > 0) {
    currentDimensions.push('provider')
  }

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
    },
    failureRate,
    providerBreakdown,
    currentDimensions,
    plannedDimensions: [
      'time',
      'model',
      'user',
      'account',
      'clientKey',
      'credential',
      'cost',
      'latency',
    ],
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
      {
        id: 'resources',
        value: formatCount(usage.length),
        detail: formatCount(providerBreakdown.length),
        tone: usage.length > 0 ? 'positive' : 'neutral',
      },
      {
        id: 'recentWindows',
        value: formatCount(recentRequestCount),
        detail: formatCount(requestErrorLogs.length),
        tone: requestErrorLogs.length > 0 ? 'warning' : 'neutral',
      },
    ],
  }
}
