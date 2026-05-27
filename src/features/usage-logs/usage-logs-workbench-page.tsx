import { type FormEvent, useState } from 'react'

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSearch,
  Filter,
  Gauge,
  Loader2,
  RefreshCw,
  Search,
  Timer,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  readUsageAnalyticsMockScenarioId,
  usageAnalyticsScenarioIds,
} from '@/features/usage-logs/usage-logs-future-model'
import type {
  UsageAnalyticsComparison,
  UsageAnalyticsComparisonId,
  UsageAnalyticsScenarioId,
  UsageAnalyticsSnapshot,
  UsageAnalyticsStatus,
} from '@/features/usage-logs/usage-logs-future-model'
import { getUsageAnalyticsMockSnapshot } from '@/features/usage-logs/usage-logs-mock-data'
import { createUsageAnalyticsModel } from '@/features/usage-logs/usage-logs-model'
import type { UsageAnalyticsModel } from '@/features/usage-logs/usage-logs-model'
import { useUsageLogsWorkbench } from '@/features/usage-logs/use-usage-logs-workbench'
import type { RuntimeMode } from '@/lib/api/management/types'
import type {
  ApiKeyUsageResource,
  RequestErrorLogFile,
  RuntimeLogSnapshot,
  UsageLogIssue,
  UsageQueueRecord,
} from '@/lib/api/management/usage-logs'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type UsageMetricTone = UsageAnalyticsModel['metrics'][number]['tone']

const usageStatusClassNames: Record<UsageAnalyticsStatus, string> = {
  success: 'border-primary/30 bg-primary/10 text-primary',
  failed: 'border-destructive/30 bg-destructive/10 text-destructive',
  rateLimited: 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning',
  quotaExceeded: 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning',
  timeout: 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning',
}

const usageStatusChartColors: Record<UsageAnalyticsStatus, string> = {
  success: 'var(--primary)',
  failed: 'var(--destructive)',
  rateLimited: 'var(--warning)',
  quotaExceeded: 'var(--info)',
  timeout: 'var(--muted-foreground)',
}

const chartInitialDimension = { width: 1, height: 1 }

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatTimestamp(value: number | null) {
  if (!value) return null
  return formatDateTime(new Date(value * 1000).toISOString())
}

function formatBytes(value: number | null) {
  if (value === null) return null
  if (value < 1024) return `${value} B`

  const units = ['KB', 'MB', 'GB']
  let nextValue = value / 1024
  let unitIndex = 0

  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024
    unitIndex += 1
  }

  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: nextValue >= 10 ? 0 : 1,
  }).format(nextValue)} ${units[unitIndex]}`
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value)
}

function formatDuration(value: number) {
  if (value >= 1000) {
    return `${new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 1,
    }).format(value / 1000)}s`
  }

  return `${formatCompactNumber(value)}ms`
}

function formatDateBucket(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function formatComparisonValue(id: UsageAnalyticsComparisonId, value: number) {
  if (id === 'cost') return formatCurrency(value)
  if (id === 'latency') return formatDuration(value)
  return formatCompactNumber(value)
}

function formatRawRecord(value: unknown) {
  if (typeof value === 'string') return value

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.URL.revokeObjectURL(url)
}

function metricToneClassName(tone: UsageMetricTone) {
  if (tone === 'positive') return 'border-success/30 bg-success/10 text-success'
  if (tone === 'warning') {
    return 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
  }
  return 'bg-muted text-muted-foreground'
}

function getDimensionKey(dimension: string) {
  return `usageLogsPage.analytics.dimensions.${dimension}`
}

function getStatusKey(status: UsageAnalyticsStatus) {
  return `usageLogsPage.mock.status.${status}`
}

function getScenarioKey(scenarioId: UsageAnalyticsScenarioId) {
  return `usageLogsPage.mock.scenarios.${scenarioId}`
}

function UsageLogsDisconnectedState() {
  const { t } = useTranslation()
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-md">
              <BarChart3 className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">
                {t('usageLogsPage.disconnected.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {t('usageLogsPage.disconnected.description')}
              </p>
            </div>
          </div>
          <Button className="md:shrink-0" onClick={openConnectionDialog}>
            <BarChart3 className="size-4" aria-hidden="true" />
            {t('usageLogsPage.disconnected.action')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function UsageLogsLoadingState() {
  return (
    <section className="grid gap-4">
      <Skeleton className="h-32 rounded-lg" />
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
      <Skeleton className="h-[480px] rounded-lg" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <Skeleton className="h-[360px] rounded-lg" />
        <Skeleton className="h-[360px] rounded-lg" />
      </div>
    </section>
  )
}

function UsageLogsErrorState({
  errorMessage,
  onRetry,
}: {
  errorMessage: string | null
  onRetry: () => void
}) {
  const { t } = useTranslation()

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="border-destructive/30 bg-destructive/10 text-destructive flex size-11 shrink-0 items-center justify-center rounded-md border">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">
                {t('usageLogsPage.error.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {errorMessage ?? t('usageLogsPage.error.description')}
              </p>
            </div>
          </div>
          <Button variant="outline" className="md:shrink-0" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {t('usageLogsPage.error.retry')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function CapabilityBadge({ available, label }: { available: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
        available
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {available ? (
        <CheckCircle2 className="size-3" aria-hidden="true" />
      ) : (
        <span className="bg-muted-foreground size-1.5 rounded-full" aria-hidden="true" />
      )}
      {label}
    </span>
  )
}

function UsageVerdictHeader({
  analytics,
  capabilities,
  runtimeMode,
  fetchedAt,
  isFetching,
  onRefresh,
}: {
  analytics: UsageAnalyticsModel
  capabilities: {
    usage: boolean
    usageQueue: boolean
    logs: boolean
    requestErrorLogs: boolean
  }
  runtimeMode: RuntimeMode
  fetchedAt: string
  isFetching: boolean
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const verdict = analytics.verdict

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 gap-3">
          <div
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-md border',
              verdict === 'ready'
                ? 'border-success/30 bg-success/10 text-success'
                : verdict === 'partial'
                  ? 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {verdict === 'ready' ? (
              <Gauge className="size-5" aria-hidden="true" />
            ) : verdict === 'partial' ? (
              <AlertTriangle className="size-5" aria-hidden="true" />
            ) : (
              <BarChart3 className="size-5" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-normal">
                {t(`usageLogsPage.verdict.${verdict}.title`)}
              </h1>
              <span
                className={cn(
                  'inline-flex rounded-md border px-2 py-1 text-xs font-medium',
                  verdict === 'ready'
                    ? 'border-success/30 bg-success/10 text-success'
                    : verdict === 'partial'
                      ? 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {t(`usageLogsPage.verdict.${verdict}.badge`)}
              </span>
            </div>
            <p className="text-muted-foreground mt-2 max-w-4xl text-sm leading-6">
              {t(`usageLogsPage.verdict.${verdict}.description`, {
                mode: t(`runtimeMode.${runtimeMode}`),
              })}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="self-start xl:shrink-0"
          disabled={isFetching}
          onClick={onRefresh}
          aria-label={
            isFetching ? t('usageLogsPage.actions.syncing') : t('usageLogsPage.actions.refresh')
          }
          title={
            isFetching ? t('usageLogsPage.actions.syncing') : t('usageLogsPage.actions.refresh')
          }
        >
          {isFetching ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          {isFetching ? t('usageLogsPage.actions.syncing') : t('usageLogsPage.actions.refresh')}
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <CapabilityBadge
          available={capabilities.usage}
          label={t('usageLogsPage.capabilities.usage')}
        />
        <CapabilityBadge
          available={capabilities.usageQueue}
          label={t('usageLogsPage.capabilities.usageQueue')}
        />
        <CapabilityBadge
          available={capabilities.logs}
          label={t('usageLogsPage.capabilities.logs')}
        />
        <CapabilityBadge
          available={capabilities.requestErrorLogs}
          label={t('usageLogsPage.capabilities.requestErrorLogs')}
        />
        <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
          {t('usageLogsPage.header.runtime', {
            mode: t(`runtimeMode.${runtimeMode}`),
          })}
        </span>
        <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
          {t('usageLogsPage.header.updatedAt', {
            time: formatDateTime(fetchedAt),
          })}
        </span>
      </div>
    </div>
  )
}

function UsageMetricCards({ analytics }: { analytics: UsageAnalyticsModel }) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {analytics.metrics.map((metric) => (
        <div key={metric.id} className="bg-card rounded-lg border p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium">
                {t(`usageLogsPage.metrics.${metric.id}.label`)}
              </p>
              <p className="mt-1.5 truncate text-2xl font-semibold tracking-normal">
                {metric.value}
              </p>
            </div>
            <div
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-md border',
                metricToneClassName(metric.tone),
              )}
            >
              {metric.id === 'failureRate' ? (
                <AlertTriangle className="size-4" aria-hidden="true" />
              ) : metric.id === 'recentWindows' ? (
                <FileSearch className="size-4" aria-hidden="true" />
              ) : metric.id === 'resources' ? (
                <BarChart3 className="size-4" aria-hidden="true" />
              ) : (
                <Gauge className="size-4" aria-hidden="true" />
              )}
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-xs leading-5">
            {t(`usageLogsPage.metrics.${metric.id}.detail`, {
              value: metric.detail,
            })}
          </p>
        </div>
      ))}
    </div>
  )
}

function UsageMockScenarioSwitcher({
  activeScenario,
}: {
  activeScenario: UsageAnalyticsScenarioId
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap gap-2">
      {usageAnalyticsScenarioIds.map((scenarioId) => (
        <Button
          key={scenarioId}
          asChild
          variant={scenarioId === activeScenario ? 'default' : 'outline'}
          size="sm"
        >
          <a href={`/usage-logs?usageMock=${scenarioId}`}>{t(getScenarioKey(scenarioId))}</a>
        </Button>
      ))}
    </div>
  )
}

function UsageMockHeader({ snapshot }: { snapshot: UsageAnalyticsSnapshot }) {
  const { t } = useTranslation()

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="border-info/30 bg-info/10 text-info flex size-11 shrink-0 items-center justify-center rounded-md border">
            <BarChart3 className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-normal">
                {t('usageLogsPage.mock.title')}
              </h1>
              <span className="border-info/30 bg-info/10 text-info inline-flex rounded-md border px-2 py-1 text-xs font-medium">
                {t('usageLogsPage.mock.badge')}
              </span>
            </div>
            <p className="text-muted-foreground mt-2 max-w-4xl text-sm leading-6">
              {t('usageLogsPage.mock.description')}
            </p>
          </div>
        </div>
        <UsageMockScenarioSwitcher activeScenario={snapshot.scenarioId} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
          {t('usageLogsPage.mock.currentScenario', {
            scenario: t(getScenarioKey(snapshot.scenarioId)),
          })}
        </span>
        <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
          {t('usageLogsPage.mock.range', {
            start: formatDateBucket(snapshot.range.start),
            end: formatDateBucket(snapshot.range.end),
          })}
        </span>
        <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
          {t('usageLogsPage.header.updatedAt', {
            time: formatDateTime(snapshot.generatedAt),
          })}
        </span>
      </div>
    </div>
  )
}

function UsageMockKpis({ snapshot }: { snapshot: UsageAnalyticsSnapshot }) {
  const { t } = useTranslation()
  const summary = snapshot.summary
  const metrics = [
    {
      id: 'requests',
      value: formatCompactNumber(summary.requests),
      detail: t('usageLogsPage.mock.kpis.requestsDetail', {
        success: formatCompactNumber(summary.success),
        failed: formatCompactNumber(summary.failed),
      }),
      tone: summary.failed > 0 ? 'warning' : summary.requests > 0 ? 'positive' : 'neutral',
    },
    {
      id: 'tokens',
      value: formatCompactNumber(summary.totalTokens),
      detail: t('usageLogsPage.mock.kpis.tokensDetail', {
        input: formatCompactNumber(summary.inputTokens),
        output: formatCompactNumber(summary.outputTokens),
      }),
      tone: summary.totalTokens > 0 ? 'positive' : 'neutral',
    },
    {
      id: 'cost',
      value: formatCurrency(summary.cost),
      detail: t('usageLogsPage.mock.kpis.costDetail', {
        count: formatCompactNumber(summary.unpricedRequests),
      }),
      tone: summary.unpricedRequests > 0 ? 'warning' : summary.cost > 0 ? 'positive' : 'neutral',
    },
    {
      id: 'latency',
      value: formatDuration(summary.avgDurationMs),
      detail: t('usageLogsPage.mock.kpis.latencyDetail', {
        firstToken: formatDuration(summary.avgFirstTokenMs),
      }),
      tone:
        summary.avgDurationMs > 2500
          ? 'warning'
          : summary.avgDurationMs > 0
            ? 'positive'
            : 'neutral',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.id} className="bg-card rounded-lg border p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium">
                {t(`usageLogsPage.mock.kpis.${metric.id}`)}
              </p>
              <p className="mt-1.5 truncate text-2xl font-semibold tracking-normal">
                {metric.value}
              </p>
            </div>
            <div
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-md border',
                metricToneClassName(metric.tone as UsageMetricTone),
              )}
            >
              {metric.id === 'latency' ? (
                <Timer className="size-4" aria-hidden="true" />
              ) : metric.id === 'cost' ? (
                <BarChart3 className="size-4" aria-hidden="true" />
              ) : (
                <Gauge className="size-4" aria-hidden="true" />
              )}
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-xs leading-5">{metric.detail}</p>
        </div>
      ))}
    </div>
  )
}

function UsageMockComparisonCards({ comparisons }: { comparisons: UsageAnalyticsComparison[] }) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {comparisons.map((comparison) => {
        const maxValue = Math.max(comparison.current, comparison.previous, 1)
        const currentWidth = Math.max(
          (comparison.current / maxValue) * 100,
          comparison.current > 0 ? 4 : 0,
        )
        const previousWidth = Math.max(
          (comparison.previous / maxValue) * 100,
          comparison.previous > 0 ? 4 : 0,
        )

        return (
          <div key={comparison.id} className="bg-card rounded-lg border p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">
                {t(`usageLogsPage.mock.comparisons.${comparison.id}`)}
              </p>
              <span
                className={cn(
                  'rounded-md border px-2 py-1 text-xs font-medium',
                  comparison.favorable
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning',
                )}
              >
                {comparison.deltaPercent > 0 ? '+' : ''}
                {comparison.deltaPercent}%
              </span>
            </div>
            <div className="mt-4 grid gap-2">
              <div>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {t('usageLogsPage.mock.comparisons.current')}
                  </span>
                  <span className="font-mono">
                    {formatComparisonValue(comparison.id, comparison.current)}
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{ width: `${currentWidth}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {t('usageLogsPage.mock.comparisons.previous')}
                  </span>
                  <span className="font-mono">
                    {formatComparisonValue(comparison.id, comparison.previous)}
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-muted-foreground/50 h-full rounded-full"
                    style={{ width: `${previousWidth}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function UsageMockTrendChart({ snapshot }: { snapshot: UsageAnalyticsSnapshot }) {
  const { t } = useTranslation()
  const chartData = snapshot.timeseries.map((bucket) => ({
    date: formatDateBucket(bucket.timestamp),
    requests: bucket.requests,
    tokens: bucket.totalTokens,
    cost: bucket.cost,
    failed: bucket.failed,
    avgDurationMs: bucket.avgDurationMs,
  }))

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <UsageSectionHeader
        title={t('usageLogsPage.mock.trend.title')}
        description={t('usageLogsPage.mock.trend.description')}
      />
      <div className="mt-4 h-80 min-w-0">
        {chartData.length > 0 ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            initialDimension={chartInitialDimension}
          >
            <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} width={48} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.35 }}
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--foreground)',
                }}
              />
              <Legend />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="requests"
                name={t('usageLogsPage.mock.trend.requests')}
                stroke="var(--primary)"
                fill="var(--primary)"
                fillOpacity={0.18}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="failed"
                name={t('usageLogsPage.mock.trend.failed')}
                stroke="var(--warning)"
                fill="var(--warning)"
                fillOpacity={0.16}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center rounded-md border text-sm">
            {t('usageLogsPage.mock.emptyChart')}
          </div>
        )}
      </div>
    </div>
  )
}

function UsageMockStatusChart({ snapshot }: { snapshot: UsageAnalyticsSnapshot }) {
  const { t } = useTranslation()

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <UsageSectionHeader
        title={t('usageLogsPage.mock.statusChart.title')}
        description={t('usageLogsPage.mock.statusChart.description')}
      />
      <div className="mt-4 h-72 min-w-0">
        {snapshot.statusDistribution.length > 0 ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            initialDimension={chartInitialDimension}
          >
            <PieChart>
              <Pie
                data={snapshot.statusDistribution}
                dataKey="requests"
                nameKey="status"
                innerRadius="58%"
                outerRadius="82%"
                paddingAngle={2}
              >
                {snapshot.statusDistribution.map((slice) => (
                  <Cell key={slice.status} fill={usageStatusChartColors[slice.status]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  formatCompactNumber(Number(value)),
                  t(getStatusKey(name as UsageAnalyticsStatus)),
                ]}
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--foreground)',
                }}
              />
              <Legend formatter={(value) => t(getStatusKey(value as UsageAnalyticsStatus))} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center rounded-md border text-sm">
            {t('usageLogsPage.mock.emptyChart')}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {snapshot.statusDistribution.map((slice) => (
          <span
            key={slice.status}
            className={cn(
              'inline-flex rounded-md border px-2.5 py-1 text-xs font-medium',
              usageStatusClassNames[slice.status],
            )}
          >
            {t(getStatusKey(slice.status))}: {formatCompactNumber(slice.requests)}
          </span>
        ))}
      </div>
    </div>
  )
}

function UsageMockBreakdownChart({
  title,
  description,
  rows,
}: {
  title: string
  description: string
  rows: UsageAnalyticsSnapshot['breakdowns']['providers']
}) {
  const { t } = useTranslation()
  const chartData = rows.slice(0, 8).map((row) => ({
    label: row.label,
    requests: row.requests,
    failed: row.failed,
    tokens: row.totalTokens,
    cost: row.cost,
  }))

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <UsageSectionHeader title={title} description={description} />
      <div className="mt-4 h-80 min-w-0">
        {chartData.length > 0 ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            initialDimension={chartInitialDimension}
          >
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 12, right: 8, top: 8, bottom: 8 }}
            >
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={120}
                tickFormatter={(value) => String(value).slice(0, 18)}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.35 }}
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--foreground)',
                }}
              />
              <Legend />
              <Bar
                dataKey="requests"
                name={t('usageLogsPage.mock.breakdown.requests')}
                fill="var(--primary)"
                radius={[0, 4, 4, 0]}
              />
              <Bar
                dataKey="failed"
                name={t('usageLogsPage.mock.breakdown.failed')}
                fill="var(--warning)"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center rounded-md border text-sm">
            {t('usageLogsPage.mock.emptyChart')}
          </div>
        )}
      </div>
    </div>
  )
}

function UsageMockRequestTable({ snapshot }: { snapshot: UsageAnalyticsSnapshot }) {
  const { t } = useTranslation()

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <UsageSectionHeader
        title={t('usageLogsPage.mock.requests.title')}
        description={t('usageLogsPage.mock.requests.description')}
      />
      <div className="mt-4 overflow-hidden rounded-md border">
        {snapshot.requestSamples.length > 0 ? (
          <div className="overflow-x-auto">
            <Table className="min-w-[1080px]">
              <TableHeader className="bg-muted/70 text-muted-foreground">
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('usageLogsPage.mock.requests.columns.request')}</TableHead>
                  <TableHead>{t('usageLogsPage.mock.requests.columns.provider')}</TableHead>
                  <TableHead>{t('usageLogsPage.mock.requests.columns.model')}</TableHead>
                  <TableHead>{t('usageLogsPage.mock.requests.columns.user')}</TableHead>
                  <TableHead>{t('usageLogsPage.mock.requests.columns.status')}</TableHead>
                  <TableHead className="text-right">
                    {t('usageLogsPage.mock.requests.columns.tokens')}
                  </TableHead>
                  <TableHead className="text-right">
                    {t('usageLogsPage.mock.requests.columns.cost')}
                  </TableHead>
                  <TableHead className="text-right">
                    {t('usageLogsPage.mock.requests.columns.latency')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.requestSamples.map((row) => (
                  <TableRow key={row.requestId} className="align-top">
                    <TableCell className="max-w-[240px]">
                      <p className="truncate font-mono text-xs">{row.requestId}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatDateTime(row.timestamp)}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">{row.provider}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[220px] truncate font-mono text-xs">
                      {row.model}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <p className="truncate">{row.username}</p>
                      <p className="text-muted-foreground mt-1 truncate text-xs">
                        {row.clientKeyName}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex rounded-md border px-2 py-1 text-xs font-medium',
                          usageStatusClassNames[row.status],
                        )}
                      >
                        {t(getStatusKey(row.status))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatCompactNumber(row.totalTokens)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatCurrency(row.cost)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatDuration(row.durationMs)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-muted-foreground px-4 py-10 text-sm">
            {t('usageLogsPage.mock.requests.empty')}
          </p>
        )}
      </div>
    </div>
  )
}

function UsageMockAnalyticsLab({ snapshot }: { snapshot: UsageAnalyticsSnapshot }) {
  const { t } = useTranslation()

  return (
    <section className="grid w-full gap-4">
      <UsageMockHeader snapshot={snapshot} />
      <div className="border-info/30 bg-info/10 text-info rounded-md border px-3 py-2.5 text-sm leading-6">
        {t('usageLogsPage.mock.contractNotice')}
      </div>
      <UsageMockKpis snapshot={snapshot} />
      <UsageMockComparisonCards comparisons={snapshot.comparisons} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <UsageMockTrendChart snapshot={snapshot} />
        <UsageMockStatusChart snapshot={snapshot} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <UsageMockBreakdownChart
          title={t('usageLogsPage.mock.breakdown.providers')}
          description={t('usageLogsPage.mock.breakdown.providersDescription')}
          rows={snapshot.breakdowns.providers}
        />
        <UsageMockBreakdownChart
          title={t('usageLogsPage.mock.breakdown.models')}
          description={t('usageLogsPage.mock.breakdown.modelsDescription')}
          rows={snapshot.breakdowns.models}
        />
        <UsageMockBreakdownChart
          title={t('usageLogsPage.mock.breakdown.users')}
          description={t('usageLogsPage.mock.breakdown.usersDescription')}
          rows={snapshot.breakdowns.users}
        />
        <UsageMockBreakdownChart
          title={t('usageLogsPage.mock.breakdown.credentials')}
          description={t('usageLogsPage.mock.breakdown.credentialsDescription')}
          rows={snapshot.breakdowns.credentials}
        />
      </div>
      <UsageMockRequestTable snapshot={snapshot} />
    </section>
  )
}

function UsageScopeNotice() {
  const { t } = useTranslation()

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <div className="flex min-w-0 gap-3">
        <div className="border-info/30 bg-info/10 text-info flex size-9 shrink-0 items-center justify-center rounded-md border">
          <Timer className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{t('usageLogsPage.scope.title')}</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            {t('usageLogsPage.scope.description')}
          </p>
        </div>
      </div>
    </div>
  )
}

function UsageFilterPreview() {
  const { t } = useTranslation()
  const filterKeys = [
    'timeRange',
    'provider',
    'model',
    'user',
    'account',
    'credential',
    'clientKey',
    'status',
  ]

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md border">
            <Filter className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t('usageLogsPage.filters.title')}</h2>
            <p className="text-muted-foreground mt-1 max-w-4xl text-sm leading-6">
              {t('usageLogsPage.filters.description')}
            </p>
          </div>
        </div>
        <span className="bg-muted text-muted-foreground inline-flex self-start rounded-md border px-2.5 py-1 text-xs font-medium">
          {t('usageLogsPage.filters.badge')}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {filterKeys.map((key) => (
          <div
            key={key}
            className="bg-muted/35 text-muted-foreground flex min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate">{t(`usageLogsPage.filters.items.${key}`)}</span>
            <span className="bg-background/70 shrink-0 rounded-md border px-2 py-0.5 text-xs">
              {t('usageLogsPage.filters.planned')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ApiKeyUsageTable({ resources }: { resources: ApiKeyUsageResource[] }) {
  const { t } = useTranslation()

  if (resources.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border px-4 py-10 text-center text-sm">
        {t('usageLogsPage.usage.empty')}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <Table className="min-w-[860px]">
          <TableHeader className="bg-muted/70 text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('usageLogsPage.usage.provider')}</TableHead>
              <TableHead>{t('usageLogsPage.usage.baseUrl')}</TableHead>
              <TableHead>{t('usageLogsPage.usage.key')}</TableHead>
              <TableHead className="text-right">{t('usageLogsPage.usage.success')}</TableHead>
              <TableHead className="text-right">{t('usageLogsPage.usage.failed')}</TableHead>
              <TableHead className="text-right">{t('usageLogsPage.usage.recentWindows')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((resource) => (
              <TableRow key={resource.id}>
                <TableCell className="font-medium">{resource.provider}</TableCell>
                <TableCell className="text-muted-foreground max-w-[300px] truncate font-mono text-xs">
                  {resource.baseUrl || t('usageLogsPage.status.notAvailable')}
                </TableCell>
                <TableCell className="font-mono text-xs">{resource.apiKeyPreview}</TableCell>
                <TableCell className="text-primary text-right">{resource.success}</TableCell>
                <TableCell className="text-right">{resource.failed}</TableCell>
                <TableCell className="text-muted-foreground text-right">
                  {resource.recentRequestCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function UsageProviderCharts({ analytics }: { analytics: UsageAnalyticsModel }) {
  const { t } = useTranslation()
  const chartData = analytics.providerBreakdown.map((item) => ({
    provider: item.provider,
    success: item.success,
    failed: item.failed,
    total: item.total,
    keys: item.keyCount,
  }))

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
      <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-semibold">{t('usageLogsPage.analytics.charts.title')}</h2>
          <p className="text-muted-foreground text-sm leading-6">
            {t('usageLogsPage.analytics.charts.description')}
          </p>
        </div>
        <div className="mt-4 h-72 min-w-0">
          {chartData.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={chartInitialDimension}
            >
              <BarChart data={chartData} margin={{ left: 0, right: 4, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="provider" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={42} />
                <Tooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.45 }}
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--foreground)',
                  }}
                />
                <Legend />
                <Bar
                  dataKey="success"
                  name={t('usageLogsPage.usage.success')}
                  stackId="requests"
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="failed"
                  name={t('usageLogsPage.usage.failed')}
                  stackId="requests"
                  fill="var(--warning)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center rounded-md border text-sm">
              {t('usageLogsPage.analytics.charts.empty')}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
        <h2 className="text-base font-semibold">{t('usageLogsPage.analytics.breakdown.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-6">
          {t('usageLogsPage.analytics.breakdown.description')}
        </p>
        <div className="mt-4 grid gap-3">
          {analytics.providerBreakdown.length > 0 ? (
            analytics.providerBreakdown.slice(0, 6).map((item) => {
              const width =
                analytics.totals.requests > 0
                  ? Math.max((item.total / analytics.totals.requests) * 100, 3)
                  : 0

              return (
                <div key={item.provider} className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{item.provider}</span>
                    <span className="text-muted-foreground shrink-0 font-mono text-xs">
                      {item.total}
                    </span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {t('usageLogsPage.analytics.breakdown.meta', {
                      success: item.success,
                      failed: item.failed,
                      keys: item.keyCount,
                    })}
                  </p>
                </div>
              )
            })
          ) : (
            <div className="text-muted-foreground rounded-md border px-4 py-8 text-sm">
              {t('usageLogsPage.analytics.breakdown.empty')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function UsageCapabilityRoadmap({ analytics }: { analytics: UsageAnalyticsModel }) {
  const { t } = useTranslation()

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t('usageLogsPage.analytics.roadmap.title')}</h2>
          <p className="text-muted-foreground mt-1 max-w-4xl text-sm leading-6">
            {t('usageLogsPage.analytics.roadmap.description')}
          </p>
        </div>
        <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
          {t('usageLogsPage.analytics.roadmap.api')}
        </span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">{t('usageLogsPage.analytics.roadmap.current')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {analytics.currentDimensions.length > 0 ? (
              analytics.currentDimensions.map((dimension) => (
                <span
                  key={dimension}
                  className="border-primary/30 bg-primary/10 text-primary inline-flex rounded-md border px-2.5 py-1 text-xs font-medium"
                >
                  {t(getDimensionKey(dimension))}
                </span>
              ))
            ) : (
              <span className="bg-muted text-muted-foreground inline-flex rounded-md border px-2.5 py-1 text-xs font-medium">
                {t('usageLogsPage.analytics.roadmap.none')}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">{t('usageLogsPage.analytics.roadmap.planned')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {analytics.plannedDimensions.map((dimension) => (
              <span
                key={dimension}
                className="bg-muted text-muted-foreground inline-flex rounded-md border px-2.5 py-1 text-xs font-medium"
              >
                {t(getDimensionKey(dimension))}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function RequestTraceLookup({
  canDownloadRequestLog,
  downloadingRequestLogId,
  isDownloadingRequestLog,
  mutating,
  onDownloadRequestLog,
}: {
  canDownloadRequestLog: boolean
  downloadingRequestLogId: string | null
  isDownloadingRequestLog: boolean
  mutating: boolean
  onDownloadRequestLog: (requestId: string) => void
}) {
  const { t } = useTranslation()
  const [requestId, setRequestId] = useState('')
  const normalizedRequestId = requestId.trim()
  const downloading =
    isDownloadingRequestLog &&
    Boolean(normalizedRequestId) &&
    downloadingRequestLogId === normalizedRequestId

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!normalizedRequestId || !canDownloadRequestLog || mutating) return
    onDownloadRequestLog(normalizedRequestId)
  }

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <div className="flex min-w-0 gap-3">
        <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md border">
          <FileSearch className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t('usageLogsPage.trace.title')}</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            {t('usageLogsPage.trace.description')}
          </p>
        </div>
      </div>
      <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
        <Input
          value={requestId}
          className="font-mono"
          placeholder={t('usageLogsPage.trace.placeholder')}
          disabled={!canDownloadRequestLog || mutating}
          onChange={(event) => setRequestId(event.target.value)}
        />
        <Button
          type="submit"
          variant="outline"
          className="sm:shrink-0"
          disabled={!canDownloadRequestLog || !normalizedRequestId || mutating}
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          {t('usageLogsPage.actions.downloadRequestLog')}
        </Button>
      </form>
      {!canDownloadRequestLog ? (
        <p className="text-muted-foreground mt-3 text-sm">{t('usageLogsPage.trace.unavailable')}</p>
      ) : null}
    </div>
  )
}

function UsageQueuePanel({
  records,
  loaded,
  canRead,
  canDownloadRequestLog,
  fetching,
  downloadingRequestLogId,
  isDownloadingRequestLog,
  mutating,
  onFetch,
  onDownloadRequestLog,
}: {
  records: UsageQueueRecord[]
  loaded: boolean
  canRead: boolean
  canDownloadRequestLog: boolean
  fetching: boolean
  downloadingRequestLogId: string | null
  isDownloadingRequestLog: boolean
  mutating: boolean
  onFetch: () => void
  onDownloadRequestLog: (requestId: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t('usageLogsPage.queue.title')}</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            {t('usageLogsPage.queue.description')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="sm:shrink-0"
          disabled={!canRead || mutating}
          onClick={onFetch}
        >
          {fetching ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          {t('usageLogsPage.actions.fetchQueue')}
        </Button>
      </div>

      {canRead ? (
        <div className="border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning mt-3 flex gap-3 rounded-md border px-3 py-2.5 text-sm leading-6">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{t('usageLogsPage.queue.consumes')}</span>
        </div>
      ) : null}

      <div className="mt-3">
        {!canRead ? (
          <div className="text-muted-foreground rounded-md border px-4 py-8 text-sm">
            {t('usageLogsPage.queue.unavailable')}
          </div>
        ) : !loaded ? (
          <div className="text-muted-foreground rounded-md border px-4 py-8 text-sm">
            {t('usageLogsPage.queue.notLoaded')}
          </div>
        ) : records.length === 0 ? (
          <div className="text-muted-foreground rounded-md border px-4 py-8 text-sm">
            {t('usageLogsPage.queue.empty')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <div className="overflow-x-auto">
              <Table className="min-w-[860px]">
                <TableHeader className="bg-muted/70 text-muted-foreground">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t('usageLogsPage.queue.columns.request')}</TableHead>
                    <TableHead>{t('usageLogsPage.queue.columns.model')}</TableHead>
                    <TableHead>{t('usageLogsPage.queue.columns.endpoint')}</TableHead>
                    <TableHead className="text-right">
                      {t('usageLogsPage.queue.columns.status')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('usageLogsPage.queue.columns.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => {
                    const requestId = record.requestId
                    const downloading =
                      isDownloadingRequestLog &&
                      Boolean(requestId) &&
                      downloadingRequestLogId === requestId

                    return (
                      <TableRow key={record.id} className="align-top">
                        <TableCell className="max-w-[280px]">
                          <p className="truncate font-mono text-xs">
                            {requestId ?? t('usageLogsPage.status.unknownRequest')}
                          </p>
                          <Collapsible className="text-muted-foreground mt-2 text-xs">
                            <CollapsibleTrigger className="group hover:text-foreground focus-visible:ring-ring/50 flex items-center gap-1.5 text-left outline-none focus-visible:ring-[3px]">
                              {t('usageLogsPage.queue.raw')}
                              <ChevronDown
                                className="size-3.5 transition-transform group-data-[state=open]:rotate-180"
                                aria-hidden="true"
                              />
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <pre className="bg-muted/50 mt-2 max-h-40 overflow-auto rounded-md border p-2 font-mono text-xs whitespace-pre-wrap">
                                {formatRawRecord(record.raw)}
                              </pre>
                            </CollapsibleContent>
                          </Collapsible>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.model ?? t('usageLogsPage.status.notAvailable')}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[260px] truncate font-mono text-xs">
                          {record.endpoint ?? t('usageLogsPage.status.notAvailable')}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              'inline-flex rounded-md border px-2 py-1 text-xs font-medium',
                              record.failed === true
                                ? 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
                                : record.failed === false
                                  ? 'border-primary/30 bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {record.failed === true
                              ? t('usageLogsPage.status.failed')
                              : record.failed === false
                                ? t('usageLogsPage.status.success')
                                : t('usageLogsPage.status.notAvailable')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {requestId ? (
                            <Button
                              type="button"
                              variant="text"
                              size="sm"
                              disabled={!canDownloadRequestLog || mutating}
                              onClick={() => onDownloadRequestLog(requestId)}
                            >
                              {downloading ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <Download className="size-4" aria-hidden="true" />
                              )}
                              {t('usageLogsPage.actions.downloadRequestLog')}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              {t('usageLogsPage.status.notAvailable')}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RuntimeLogViewer({
  runtimeLogs,
  canRead,
  canClear,
  clearing,
  mutating,
  onClear,
}: {
  runtimeLogs: RuntimeLogSnapshot | null
  canRead: boolean
  canClear: boolean
  clearing: boolean
  mutating: boolean
  onClear: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t('usageLogsPage.logs.title')}</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            {t('usageLogsPage.logs.description')}
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={!canClear || mutating} onClick={onClear}>
          {clearing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="size-4" aria-hidden="true" />
          )}
          {t('usageLogsPage.actions.clearLogs')}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
          {t('usageLogsPage.logs.lineCount', { count: runtimeLogs?.lineCount ?? 0 })}
        </span>
        <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
          {runtimeLogs?.latestTimestamp
            ? t('usageLogsPage.logs.latest', {
                time: formatTimestamp(runtimeLogs.latestTimestamp),
              })
            : t('usageLogsPage.logs.latestUnavailable')}
        </span>
      </div>

      <div className="bg-muted/40 mt-3 overflow-hidden rounded-md border">
        {!canRead ? (
          <p className="text-muted-foreground px-3 py-8 text-sm">
            {t('usageLogsPage.logs.unavailable')}
          </p>
        ) : runtimeLogs?.lines.length ? (
          <div className="max-h-96 overflow-auto">
            {runtimeLogs.lines.map((line, index) => (
              <div
                key={`${index}:${line}`}
                className="grid grid-cols-[3rem_minmax(0,1fr)] border-b last:border-b-0"
              >
                <span className="text-muted-foreground bg-muted/60 px-3 py-1.5 text-right font-mono text-xs">
                  {index + 1}
                </span>
                <pre className="px-3 py-1.5 font-mono text-xs leading-5 break-words whitespace-pre-wrap">
                  {line}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground px-3 py-8 text-sm">{t('usageLogsPage.logs.empty')}</p>
        )}
      </div>
    </div>
  )
}

function ErrorLogFilesPanel({
  requestErrorLogs,
  canRead,
  mutating,
  downloadingErrorLogName,
  isDownloadingErrorLog,
  onDownloadErrorLog,
}: {
  requestErrorLogs: RequestErrorLogFile[]
  canRead: boolean
  mutating: boolean
  downloadingErrorLogName: string | null
  isDownloadingErrorLog: boolean
  onDownloadErrorLog: (fileName: string) => void
}) {
  const { t } = useTranslation()
  const [logSearchInput, setLogSearchInput] = useState('')
  const [logSearchQuery, setLogSearchQuery] = useState('')
  const normalizedLogSearchQuery = logSearchQuery.trim()
  const normalizedLogSearchInput = logSearchInput.trim()
  const logRows = normalizedLogSearchQuery
    ? requestErrorLogs.filter((file) =>
        file.name.toLowerCase().includes(normalizedLogSearchQuery.toLowerCase()),
      )
    : requestErrorLogs

  const handleSearchLogs = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLogSearchQuery(normalizedLogSearchInput)
  }

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t('usageLogsPage.errorLogs.title')}</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            {t('usageLogsPage.errorLogs.description')}
          </p>
        </div>
        <form className="min-w-0 lg:w-72 xl:w-96" onSubmit={handleSearchLogs}>
          <div className="relative min-w-0">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              value={logSearchInput}
              placeholder={t('usageLogsPage.errorLogs.searchPlaceholder')}
              disabled={!canRead || mutating}
              onChange={(event) => setLogSearchInput(event.target.value)}
            />
          </div>
        </form>
      </div>

      <div className="mt-3 overflow-hidden rounded-md border">
        {!canRead ? (
          <p className="text-muted-foreground px-3 py-8 text-sm">
            {t('usageLogsPage.errorLogs.unavailable')}
          </p>
        ) : logRows.length > 0 ? (
          <div className="overflow-x-auto">
            <Table className="min-w-[680px]">
              <TableHeader className="bg-muted/70 text-muted-foreground">
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('usageLogsPage.errorLogs.columns.name')}</TableHead>
                  <TableHead>{t('usageLogsPage.errorLogs.columns.modified')}</TableHead>
                  <TableHead className="text-right">
                    {t('usageLogsPage.errorLogs.columns.size')}
                  </TableHead>
                  <TableHead className="text-right">
                    {t('usageLogsPage.errorLogs.columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logRows.map((row) => {
                  const downloading = isDownloadingErrorLog && downloadingErrorLogName === row.name

                  return (
                    <TableRow key={row.name}>
                      <TableCell className="max-w-[340px] truncate font-mono text-xs">
                        {row.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTimestamp(row.modified) ?? t('usageLogsPage.status.notAvailable')}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right">
                        {formatBytes(row.size) ?? t('usageLogsPage.status.notAvailable')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="text"
                          size="sm"
                          disabled={mutating}
                          onClick={() => onDownloadErrorLog(row.name)}
                        >
                          {downloading ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Download className="size-4" aria-hidden="true" />
                          )}
                          {t('usageLogsPage.actions.download')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-muted-foreground px-3 py-8 text-sm">
            {t('usageLogsPage.errorLogs.empty')}
          </p>
        )}
      </div>
    </div>
  )
}

function IssueList({ issues }: { issues: UsageLogIssue[] }) {
  const { t } = useTranslation()
  if (issues.length === 0) return null

  return (
    <div className="border-warning/30 bg-warning/8 text-warning-foreground dark:text-warning rounded-md border px-3 py-2.5 text-sm">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{t('usageLogsPage.issues.title')}</h2>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {issues.map((issue) => (
              <div key={`${issue.scope}:${issue.message}`}>
                <span className="font-medium">{t(`usageLogsPage.issueScopes.${issue.scope}`)}</span>
                <span className="opacity-85"> · {issue.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function UsageSectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-w-0">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-muted-foreground mt-1 text-sm leading-6">{description}</p>
    </div>
  )
}

function UsageLogsLiveWorkbenchPage() {
  const { t } = useTranslation()
  const workbench = useUsageLogsWorkbench()
  const [clearLogsDialogOpen, setClearLogsDialogOpen] = useState(false)
  const capabilities = workbench.capabilities
  const noRuntimeLogCapabilities =
    !capabilities.usage &&
    !capabilities.usageQueue &&
    !capabilities.logs &&
    !capabilities.requestErrorLogs

  if (!workbench.connected) {
    return <UsageLogsDisconnectedState />
  }

  if (!workbench.capabilityReady || workbench.isPending) {
    return <UsageLogsLoadingState />
  }

  if (workbench.isError || !workbench.snapshot) {
    return <UsageLogsErrorState errorMessage={workbench.errorMessage} onRetry={workbench.refetch} />
  }

  const analytics = createUsageAnalyticsModel({
    usage: workbench.snapshot.apiKeyUsage,
    runtimeLogs: workbench.snapshot.runtimeLogs,
    requestErrorLogs: workbench.snapshot.requestErrorLogs,
    issues: workbench.snapshot.issues,
    capabilities,
    settings: workbench.snapshot.settings,
  })

  const handleClearLogs = async () => {
    try {
      await workbench.clearLogs()
      setClearLogsDialogOpen(false)
      toast.success(t('usageLogsPage.toast.logsCleared'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleFetchUsageQueue = async () => {
    try {
      const records = await workbench.fetchUsageQueue()
      toast.success(t('usageLogsPage.toast.queueFetched', { count: records.length }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleDownloadErrorLog = async (fileName: string) => {
    try {
      const result = await workbench.downloadRequestErrorLog(fileName)
      downloadBlob(result.blob, result.fileName)
      toast.success(t('usageLogsPage.toast.logDownloaded'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleDownloadRequestLog = async (requestId: string) => {
    try {
      const result = await workbench.downloadRequestLogById(requestId)
      downloadBlob(result.blob, result.fileName)
      toast.success(t('usageLogsPage.toast.logDownloaded'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section className="grid w-full gap-4">
      <UsageVerdictHeader
        analytics={analytics}
        capabilities={capabilities}
        runtimeMode={workbench.runtimeMode}
        fetchedAt={workbench.snapshot.fetchedAt}
        isFetching={workbench.isFetching}
        onRefresh={workbench.refetch}
      />

      {noRuntimeLogCapabilities ? (
        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <div className="flex gap-4">
            <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold">{t('usageLogsPage.unavailable.title')}</h2>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                {t('usageLogsPage.unavailable.description', {
                  mode: t(`runtimeMode.${workbench.runtimeMode}`),
                })}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <IssueList issues={workbench.snapshot.issues} />

      <UsageScopeNotice />

      <UsageFilterPreview />

      <UsageMetricCards analytics={analytics} />

      <UsageCapabilityRoadmap analytics={analytics} />

      <UsageProviderCharts analytics={analytics} />

      <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
        <UsageSectionHeader
          title={t('usageLogsPage.usage.title')}
          description={t('usageLogsPage.usage.description')}
        />
        <div className="mt-3">
          <ApiKeyUsageTable resources={workbench.snapshot.apiKeyUsage} />
        </div>
      </div>

      <UsageSectionHeader
        title={t('usageLogsPage.operations.title')}
        description={t('usageLogsPage.operations.description')}
      />

      <div className="grid gap-4">
        <RequestTraceLookup
          canDownloadRequestLog={capabilities.requestErrorLogs}
          downloadingRequestLogId={workbench.downloadingRequestLogId}
          isDownloadingRequestLog={workbench.isDownloadingRequestLog}
          mutating={workbench.mutating}
          onDownloadRequestLog={(requestId) => void handleDownloadRequestLog(requestId)}
        />
        <UsageQueuePanel
          records={workbench.usageQueueRecords}
          loaded={workbench.usageQueueLoaded}
          canRead={capabilities.usageQueue}
          canDownloadRequestLog={capabilities.requestErrorLogs}
          fetching={workbench.isFetchingUsageQueue}
          downloadingRequestLogId={workbench.downloadingRequestLogId}
          isDownloadingRequestLog={workbench.isDownloadingRequestLog}
          mutating={workbench.mutating}
          onFetch={() => void handleFetchUsageQueue()}
          onDownloadRequestLog={(requestId) => void handleDownloadRequestLog(requestId)}
        />
        <RuntimeLogViewer
          runtimeLogs={workbench.snapshot.runtimeLogs}
          canRead={capabilities.logs}
          canClear={capabilities.logs}
          clearing={workbench.isClearingLogs}
          mutating={workbench.mutating}
          onClear={() => setClearLogsDialogOpen(true)}
        />
        <ErrorLogFilesPanel
          requestErrorLogs={workbench.snapshot.requestErrorLogs}
          canRead={capabilities.requestErrorLogs}
          mutating={workbench.mutating}
          downloadingErrorLogName={workbench.downloadingErrorLogName}
          isDownloadingErrorLog={workbench.isDownloadingErrorLog}
          onDownloadErrorLog={(fileName) => void handleDownloadErrorLog(fileName)}
        />
      </div>

      <AlertDialog open={clearLogsDialogOpen} onOpenChange={setClearLogsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('usageLogsPage.confirm.clearLogsTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('usageLogsPage.confirm.clearLogs')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={workbench.mutating}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 text-white"
              disabled={workbench.mutating}
              onClick={(event) => {
                event.preventDefault()
                void handleClearLogs()
              }}
            >
              {workbench.isClearingLogs ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('usageLogsPage.actions.clearLogs')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

export function UsageLogsWorkbenchPage() {
  const mockScenarioId = readUsageAnalyticsMockScenarioId()

  if (mockScenarioId) {
    return <UsageMockAnalyticsLab snapshot={getUsageAnalyticsMockSnapshot(mockScenarioId)} />
  }

  return <UsageLogsLiveWorkbenchPage />
}
