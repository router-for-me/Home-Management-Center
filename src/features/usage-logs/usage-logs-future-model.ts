export const usageAnalyticsScenarioIds = ['normal', 'spiky', 'empty', 'long-tail'] as const

export type UsageAnalyticsScenarioId = (typeof usageAnalyticsScenarioIds)[number]

export type UsageAnalyticsStatus =
  | 'success'
  | 'failed'
  | 'rateLimited'
  | 'quotaExceeded'
  | 'timeout'

export type UsageAnalyticsComparisonId = 'requests' | 'tokens' | 'cost' | 'latency'

export type UsageAnalyticsRange = {
  start: string
  end: string
  bucket: 'hour' | 'day'
}

export type UsageAnalyticsSummary = {
  requests: number
  success: number
  failed: number
  failureRate: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  cost: number
  avgDurationMs: number
  avgFirstTokenMs: number
  activeClientKeys: number
  activeModels: number
  unpricedRequests: number
}

export type UsageAnalyticsTimeBucket = {
  timestamp: string
  requests: number
  success: number
  failed: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  cost: number
  avgDurationMs: number
  avgFirstTokenMs: number
}

export type UsageAnalyticsBreakdownItem = {
  id: string
  label: string
  requests: number
  failed: number
  totalTokens: number
  cost: number
  avgDurationMs: number
}

export type UsageAnalyticsStatusSlice = {
  status: UsageAnalyticsStatus
  requests: number
}

export type UsageAnalyticsComparison = {
  id: UsageAnalyticsComparisonId
  current: number
  previous: number
  deltaPercent: number
  favorable: boolean
}

export type UsageAnalyticsRequestRow = {
  requestId: string
  timestamp: string
  provider: string
  model: string
  accountLabel: string
  clientKeyName: string
  username: string
  status: UsageAnalyticsStatus
  totalTokens: number
  cost: number
  durationMs: number
  firstTokenMs: number
}

export type UsageAnalyticsSnapshot = {
  scenarioId: UsageAnalyticsScenarioId
  generatedAt: string
  range: UsageAnalyticsRange
  summary: UsageAnalyticsSummary
  timeseries: UsageAnalyticsTimeBucket[]
  breakdowns: {
    providers: UsageAnalyticsBreakdownItem[]
    models: UsageAnalyticsBreakdownItem[]
    users: UsageAnalyticsBreakdownItem[]
    accounts: UsageAnalyticsBreakdownItem[]
    credentials: UsageAnalyticsBreakdownItem[]
    clientKeys: UsageAnalyticsBreakdownItem[]
  }
  statusDistribution: UsageAnalyticsStatusSlice[]
  comparisons: UsageAnalyticsComparison[]
  requestSamples: UsageAnalyticsRequestRow[]
}

function isUsageAnalyticsScenarioId(
  value: string | null | undefined,
): value is UsageAnalyticsScenarioId {
  return usageAnalyticsScenarioIds.includes(value as UsageAnalyticsScenarioId)
}

export function readUsageAnalyticsMockScenarioId() {
  const envScenario = import.meta.env.PUBLIC_USAGE_ANALYTICS_MOCK_SCENARIO

  if (isUsageAnalyticsScenarioId(envScenario)) {
    return envScenario
  }

  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return null
  }

  const urlScenario = new URLSearchParams(window.location.search).get('usageMock')
  return isUsageAnalyticsScenarioId(urlScenario) ? urlScenario : null
}
