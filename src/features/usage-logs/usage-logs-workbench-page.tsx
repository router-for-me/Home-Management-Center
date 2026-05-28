import { type FormEvent, useState } from 'react'

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import { useIsMobile } from '@/hooks/use-mobile'
import type { RuntimeMode } from '@/lib/api/management/types'
import type {
  ApiKeyUsageResource,
  RequestErrorLogFile,
  RuntimeLogSnapshot,
  UsageAnalyticsFilters,
  UsageAnalyticsOptionItem,
  UsageAnalyticsOptions,
  UsageAnalyticsOverview,
  UsageDistributionItem,
  UsageLogIssue,
  UsageQueueRecord,
  UsageRankingItem,
  UsageRequestRecord,
  UsageRequestRecordDetail,
  UsageRequestRecordsPage,
} from '@/lib/api/management/usage-logs'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type UsageMetricTone = UsageAnalyticsModel['metrics'][number]['tone']
type UsageFilterRange = '24h' | '3d' | '7d' | '30d'
type UsageFailedFilter = 'all' | 'success' | 'failed'

type UsageFilterDraft = {
  range: UsageFilterRange
  userId: string
  apiKeyDescription: string
  provider: string
  model: string
  sourceKey: string
  endpoint: string
  failed: UsageFailedFilter
  requestId: string
}

const allFilterValue = '__all__'

const defaultUsageFilterDraft: UsageFilterDraft = {
  range: '24h',
  userId: allFilterValue,
  apiKeyDescription: allFilterValue,
  provider: allFilterValue,
  model: allFilterValue,
  sourceKey: allFilterValue,
  endpoint: allFilterValue,
  failed: 'all',
  requestId: '',
}

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

function getUsageRangeStart(range: UsageFilterRange, end: Date) {
  const start = new Date(end)
  if (range === '24h') start.setHours(start.getHours() - 24)
  if (range === '3d') start.setDate(start.getDate() - 3)
  if (range === '7d') start.setDate(start.getDate() - 7)
  if (range === '30d') start.setDate(start.getDate() - 30)
  return start
}

function readFilterValue(value: string) {
  const trimmed = value.trim()
  return trimmed && trimmed !== allFilterValue ? trimmed : undefined
}

function readNumericFilterValue(value: string) {
  const normalizedValue = readFilterValue(value)
  if (!normalizedValue) return undefined

  const numericValue = Number(normalizedValue)
  return Number.isFinite(numericValue) ? numericValue : undefined
}

function createUsageAnalyticsFilters(draft: UsageFilterDraft): UsageAnalyticsFilters {
  const end = new Date()
  const failed = draft.failed === 'failed' ? true : draft.failed === 'success' ? false : undefined

  return {
    scope: 'admin',
    start: getUsageRangeStart(draft.range, end).toISOString(),
    end: end.toISOString(),
    userId: readNumericFilterValue(draft.userId),
    apiKeyDescription: readFilterValue(draft.apiKeyDescription),
    provider: readFilterValue(draft.provider),
    model: readFilterValue(draft.model),
    sourceKey: readFilterValue(draft.sourceKey),
    endpoint: readFilterValue(draft.endpoint),
    failed,
    requestId: readFilterValue(draft.requestId),
  }
}

function countActiveUsageFilters(draft: UsageFilterDraft) {
  const filterValues = [
    draft.userId,
    draft.apiKeyDescription,
    draft.provider,
    draft.model,
    draft.sourceKey,
    draft.endpoint,
    draft.failed,
  ]

  return (
    filterValues.filter((value) => value !== allFilterValue && value !== 'all').length +
    (draft.requestId.trim() ? 1 : 0)
  )
}

function toValidDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateTime(value: string) {
  const date = toValidDate(value)
  if (!date) return value

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
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

function formatFullNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value)
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value)}%`
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

function formatOptionalDuration(value: number | null) {
  return value === null ? null : formatDuration(value)
}

function formatDateBucket(value: string) {
  const date = toValidDate(value)
  if (!date) return value

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function formatComparisonValue(id: UsageAnalyticsComparisonId, value: number) {
  if (id === 'cost') return formatCurrency(value)
  if (id === 'latency') return formatDuration(value)
  return formatCompactNumber(value)
}

function truncateMiddle(value: string, maxLength: number) {
  if (value.length <= maxLength) return value

  const keep = Math.max(maxLength - 1, 4)
  const start = Math.ceil(keep / 2)
  const end = Math.floor(keep / 2)
  return `${value.slice(0, start)}…${value.slice(value.length - end)}`
}

function formatRawRecord(value: unknown) {
  if (typeof value === 'string') return value

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function getUsageRequestStatusKey(record: UsageRequestRecord) {
  if (record.failed === true) return 'failed'
  if (record.failed === false) return 'success'
  return 'unknown'
}

function getUsageRequestStatusClassName(record: UsageRequestRecord) {
  if (record.failed === true) {
    return 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
  }

  if (record.failed === false) return 'border-primary/30 bg-primary/10 text-primary'

  return 'bg-muted text-muted-foreground'
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
    usageAnalytics: boolean
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
          available={capabilities.usageAnalytics}
          label={t('usageLogsPage.capabilities.usageAnalytics')}
        />
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

function formatTrendBucket(value: string) {
  const date = toValidDate(value)
  if (!date) return value

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
  }).format(date)
}

function UsageProductionTrendPanel({ overview }: { overview: UsageAnalyticsOverview }) {
  const { t } = useTranslation()
  const chartData = overview.trends.map((bucket) => ({
    bucket: formatTrendBucket(bucket.bucket),
    records: bucket.records,
    failedRecords: bucket.failedRecords,
    totalTokens: bucket.totalTokens,
    estimatedCostUsd: bucket.estimatedCostUsd,
  }))

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <UsageSectionHeader
        title={t('usageLogsPage.production.trend.title')}
        description={t('usageLogsPage.production.trend.description')}
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
              <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} width={48} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={56}
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
                dataKey="records"
                name={t('usageLogsPage.production.trend.requests')}
                stroke="var(--primary)"
                fill="var(--primary)"
                fillOpacity={0.16}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="failedRecords"
                name={t('usageLogsPage.production.trend.failed')}
                stroke="var(--warning)"
                fill="var(--warning)"
                fillOpacity={0.14}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="totalTokens"
                name={t('usageLogsPage.production.trend.tokens')}
                stroke="var(--info)"
                fill="var(--info)"
                fillOpacity={0.1}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center rounded-md border text-sm">
            {t('usageLogsPage.production.trend.empty')}
          </div>
        )}
      </div>
    </div>
  )
}

function UsageProductionTokenPanel({ overview }: { overview: UsageAnalyticsOverview }) {
  const { t } = useTranslation()
  const summary = overview.summary
  const tokenRows = [
    { id: 'input', value: summary.inputTokens },
    { id: 'output', value: summary.outputTokens },
    { id: 'cached', value: summary.cachedTokens },
    { id: 'cacheRead', value: summary.cacheReadTokens },
    { id: 'cacheCreation', value: summary.cacheCreationTokens },
    { id: 'reasoning', value: summary.reasoningTokens },
  ].filter((row) => row.value > 0)
  const totalTokens = Math.max(summary.totalTokens, ...tokenRows.map((row) => row.value), 0)

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <UsageSectionHeader
        title={t('usageLogsPage.production.tokens.title')}
        description={t('usageLogsPage.production.tokens.description')}
      />
      <div className="mt-4 grid gap-3">
        {tokenRows.length > 0 ? (
          tokenRows.map((row) => {
            const width = totalTokens > 0 ? Math.max((row.value / totalTokens) * 100, 3) : 0

            return (
              <div key={row.id} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">
                    {t(`usageLogsPage.production.tokens.items.${row.id}`)}
                  </span>
                  <span className="text-muted-foreground shrink-0 font-mono text-xs">
                    {formatCompactNumber(row.value)}
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${width}%` }} />
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-muted-foreground rounded-md border px-4 py-8 text-sm">
            {t('usageLogsPage.production.tokens.empty')}
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1">
          {t('usageLogsPage.production.tokens.total', {
            value: formatFullNumber(summary.totalTokens),
          })}
        </span>
        <span
          className={cn(
            'rounded-md border px-2.5 py-1',
            summary.unpricedRecords > 0
              ? 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {t('usageLogsPage.production.tokens.unpriced', {
            value: formatFullNumber(summary.unpricedRecords),
          })}
        </span>
      </div>
    </div>
  )
}

function UsageProductionActivityPanel({ overview }: { overview: UsageAnalyticsOverview }) {
  const { t } = useTranslation()
  const activityRows = overview.trends.slice(-8)
  const maxRequests = Math.max(...activityRows.map((row) => row.records), 0)
  const maxTokens = Math.max(...activityRows.map((row) => row.totalTokens), 0)

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <UsageSectionHeader
        title={t('usageLogsPage.production.activity.title')}
        description={t('usageLogsPage.production.activity.description')}
      />
      <div className="mt-4 grid gap-3">
        {activityRows.length > 0 ? (
          activityRows.map((row) => {
            const requestWidth =
              maxRequests > 0 ? Math.max((row.records / maxRequests) * 100, 3) : 0
            const tokenWidth = maxTokens > 0 ? Math.max((row.totalTokens / maxTokens) * 100, 3) : 0

            return (
              <div key={row.bucket} className="grid gap-2 rounded-md border px-3 py-2.5">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {formatTrendBucket(row.bucket)}
                  </span>
                  <span className="text-muted-foreground shrink-0 font-mono text-xs">
                    {t('usageLogsPage.production.activity.meta', {
                      requests: formatCompactNumber(row.records),
                      tokens: formatCompactNumber(row.totalTokens),
                    })}
                  </span>
                </div>
                <div className="grid gap-1.5">
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${requestWidth}%` }}
                    />
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-info h-full rounded-full"
                      style={{ width: `${tokenWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-muted-foreground rounded-md border px-4 py-8 text-sm">
            {t('usageLogsPage.production.activity.empty')}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="text-muted-foreground inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1">
          <span className="bg-primary size-2 rounded-full" aria-hidden="true" />
          {t('usageLogsPage.production.activity.requests')}
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1">
          <span className="bg-info size-2 rounded-full" aria-hidden="true" />
          {t('usageLogsPage.production.activity.tokens')}
        </span>
      </div>
    </div>
  )
}

function UsageProductionExceptionPanel({ overview }: { overview: UsageAnalyticsOverview }) {
  const { t } = useTranslation()
  const summary = overview.summary
  const errorRows = overview.distributions.errors.slice(0, 5)
  const maxErrorRecords = Math.max(...errorRows.map((row) => row.records), summary.failedRecords, 0)

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <UsageSectionHeader
          title={t('usageLogsPage.production.exceptions.title')}
          description={t('usageLogsPage.production.exceptions.description')}
        />
        <span
          className={cn(
            'inline-flex self-start rounded-md border px-2.5 py-1 text-xs font-medium',
            summary.failedRecords > 0
              ? 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
              : 'border-success/30 bg-success/10 text-success',
          )}
        >
          {t('usageLogsPage.production.exceptions.failureRate', {
            value: formatPercent(summary.failureRate),
          })}
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        {errorRows.length > 0 ? (
          errorRows.map((row) => {
            const width =
              maxErrorRecords > 0 ? Math.max((row.records / maxErrorRecords) * 100, 3) : 0

            return (
              <div key={row.key} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium" title={row.label}>
                    {row.label}
                  </span>
                  <span className="text-muted-foreground shrink-0 font-mono text-xs">
                    {formatCompactNumber(row.records)}
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div className="bg-warning h-full rounded-full" style={{ width: `${width}%` }} />
                </div>
                <p className="text-muted-foreground text-xs">
                  {t('usageLogsPage.production.exceptions.meta', {
                    tokens: formatCompactNumber(row.totalTokens),
                    cost: formatCurrency(row.estimatedCostUsd),
                  })}
                </p>
              </div>
            )
          })
        ) : summary.failedRecords > 0 ? (
          <div className="border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning rounded-md border px-4 py-8 text-sm">
            {t('usageLogsPage.production.exceptions.noBreakdown', {
              count: formatCompactNumber(summary.failedRecords),
            })}
          </div>
        ) : (
          <div className="text-muted-foreground rounded-md border px-4 py-8 text-sm">
            {t('usageLogsPage.production.exceptions.empty')}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
          {t('usageLogsPage.production.exceptions.failed', {
            value: formatCompactNumber(summary.failedRecords),
          })}
        </span>
        <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
          {t('usageLogsPage.production.exceptions.success', {
            value: formatCompactNumber(summary.successRecords),
          })}
        </span>
      </div>
    </div>
  )
}

function UsageProductionDistributionList({
  title,
  description,
  items,
  total,
  empty,
}: {
  title: string
  description: string
  items: UsageDistributionItem[]
  total: number
  empty: string
}) {
  const { t } = useTranslation()

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <UsageSectionHeader title={title} description={description} />
      <div className="mt-4 grid gap-3">
        {items.length > 0 ? (
          items.slice(0, 6).map((item) => {
            const width = total > 0 ? Math.max((item.records / total) * 100, 3) : 0

            return (
              <div key={item.key} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium" title={item.label}>
                    {item.label}
                  </span>
                  <span className="text-muted-foreground shrink-0 font-mono text-xs">
                    {formatCompactNumber(item.records)}
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${width}%` }} />
                </div>
                <p className="text-muted-foreground text-xs">
                  {t('usageLogsPage.production.distributions.meta', {
                    tokens: formatCompactNumber(item.totalTokens),
                    cost: formatCurrency(item.estimatedCostUsd),
                    failed: formatCompactNumber(item.failedRecords),
                  })}
                </p>
              </div>
            )
          })
        ) : (
          <div className="text-muted-foreground rounded-md border px-4 py-8 text-sm">{empty}</div>
        )}
      </div>
    </div>
  )
}

function UsageProductionRankingColumn({
  title,
  items,
}: {
  title: string
  items: UsageRankingItem[]
}) {
  const { t } = useTranslation()

  return (
    <div className="min-w-0">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.length > 0 ? (
          items.slice(0, 5).map((item, index) => (
            <div key={`${item.key}:${index}`} className="min-w-0 border-b pb-2 last:border-b-0">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={item.label}>
                    {item.label}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {t('usageLogsPage.production.rankings.meta', {
                      requests: formatCompactNumber(item.records),
                      failed: formatCompactNumber(item.failedRecords),
                    })}
                  </p>
                </div>
                <span className="bg-muted text-muted-foreground shrink-0 rounded-md border px-2 py-0.5 font-mono text-xs">
                  {formatCompactNumber(item.totalTokens)}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground rounded-md border px-3 py-6 text-sm">
            {t('usageLogsPage.production.rankings.empty')}
          </p>
        )}
      </div>
    </div>
  )
}

function UsageProductionRankingPanel({ overview }: { overview: UsageAnalyticsOverview }) {
  const { t } = useTranslation()

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <UsageSectionHeader
        title={t('usageLogsPage.production.rankings.title')}
        description={t('usageLogsPage.production.rankings.description')}
      />
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <UsageProductionRankingColumn
          title={t('usageLogsPage.production.rankings.users')}
          items={overview.userRanking}
        />
        <UsageProductionRankingColumn
          title={t('usageLogsPage.production.rankings.clientKeys')}
          items={overview.clientKeyRanking}
        />
        <UsageProductionRankingColumn
          title={t('usageLogsPage.production.rankings.models')}
          items={overview.modelRanking}
        />
      </div>
    </div>
  )
}

function UsageAnalyticsFilterSelect({
  label,
  value,
  allLabel,
  options,
  disabled,
  onValueChange,
}: {
  label: string
  value: string
  allLabel: string
  options: UsageAnalyticsOptionItem[]
  disabled?: boolean
  onValueChange: (value: string) => void
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <Select value={value} disabled={disabled} onValueChange={onValueChange}>
        <SelectTrigger size="sm" className="min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={allFilterValue}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

function UsageProductionFilterBar({
  draft,
  options,
  isFetching,
  onChange,
  onApply,
  onReset,
}: {
  draft: UsageFilterDraft
  options: UsageAnalyticsOptions | null
  isFetching: boolean
  onChange: (draft: UsageFilterDraft) => void
  onApply: () => void
  onReset: () => void
}) {
  const { t } = useTranslation()
  const activeFilters = countActiveUsageFilters(draft)
  const optionCount = options
    ? options.users.length +
      options.clientKeys.length +
      options.providers.length +
      options.models.length +
      options.credentials.length +
      options.endpoints.length
    : 0
  const updateDraft = <Key extends keyof UsageFilterDraft>(
    key: Key,
    value: UsageFilterDraft[Key],
  ) => {
    onChange({
      ...draft,
      [key]: value,
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onApply()
  }

  return (
    <form className="bg-card rounded-lg border p-4 shadow-sm" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md border">
            <Filter className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">
              {t('usageLogsPage.production.filters.title')}
            </h2>
            <p className="text-muted-foreground mt-1 max-w-4xl text-sm leading-6">
              {t('usageLogsPage.production.filters.description')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('usageLogsPage.production.filters.active', { count: activeFilters })}
          </span>
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('usageLogsPage.production.filters.options', { count: optionCount })}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid min-w-0 gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">
            {t('usageLogsPage.production.filters.fields.range')}
          </span>
          <Select
            value={draft.range}
            onValueChange={(value) => updateDraft('range', value as UsageFilterRange)}
          >
            <SelectTrigger size="sm" className="min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['24h', '3d', '7d', '30d'] as UsageFilterRange[]).map((range) => (
                <SelectItem key={range} value={range}>
                  {t(`usageLogsPage.production.filters.ranges.${range}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <UsageAnalyticsFilterSelect
          label={t('usageLogsPage.production.filters.fields.user')}
          value={draft.userId}
          allLabel={t('usageLogsPage.production.filters.all')}
          options={options?.users ?? []}
          disabled={!options?.users.length}
          onValueChange={(value) => updateDraft('userId', value)}
        />
        <UsageAnalyticsFilterSelect
          label={t('usageLogsPage.production.filters.fields.clientKey')}
          value={draft.apiKeyDescription}
          allLabel={t('usageLogsPage.production.filters.all')}
          options={options?.clientKeys ?? []}
          disabled={!options?.clientKeys.length}
          onValueChange={(value) => updateDraft('apiKeyDescription', value)}
        />
        <UsageAnalyticsFilterSelect
          label={t('usageLogsPage.production.filters.fields.provider')}
          value={draft.provider}
          allLabel={t('usageLogsPage.production.filters.all')}
          options={options?.providers ?? []}
          disabled={!options?.providers.length}
          onValueChange={(value) => updateDraft('provider', value)}
        />
        <UsageAnalyticsFilterSelect
          label={t('usageLogsPage.production.filters.fields.model')}
          value={draft.model}
          allLabel={t('usageLogsPage.production.filters.all')}
          options={options?.models ?? []}
          disabled={!options?.models.length}
          onValueChange={(value) => updateDraft('model', value)}
        />
        <UsageAnalyticsFilterSelect
          label={t('usageLogsPage.production.filters.fields.credential')}
          value={draft.sourceKey}
          allLabel={t('usageLogsPage.production.filters.all')}
          options={options?.credentials ?? []}
          disabled={!options?.credentials.length}
          onValueChange={(value) => updateDraft('sourceKey', value)}
        />
        <UsageAnalyticsFilterSelect
          label={t('usageLogsPage.production.filters.fields.endpoint')}
          value={draft.endpoint}
          allLabel={t('usageLogsPage.production.filters.all')}
          options={options?.endpoints ?? []}
          disabled={!options?.endpoints.length}
          onValueChange={(value) => updateDraft('endpoint', value)}
        />
        <label className="grid min-w-0 gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">
            {t('usageLogsPage.production.filters.fields.status')}
          </span>
          <Select
            value={draft.failed}
            onValueChange={(value) => updateDraft('failed', value as UsageFailedFilter)}
          >
            <SelectTrigger size="sm" className="min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('usageLogsPage.production.filters.status.all')}
              </SelectItem>
              <SelectItem value="success">
                {t('usageLogsPage.production.filters.status.success')}
              </SelectItem>
              <SelectItem value="failed">
                {t('usageLogsPage.production.filters.status.failed')}
              </SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="grid min-w-0 flex-1 gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">
            {t('usageLogsPage.production.filters.fields.requestId')}
          </span>
          <Input
            value={draft.requestId}
            className="h-8 font-mono text-sm"
            placeholder={t('usageLogsPage.production.filters.requestIdPlaceholder')}
            onChange={(event) => updateDraft('requestId', event.target.value)}
          />
        </label>
        <div className="flex gap-2 lg:shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={onReset}>
            {t('usageLogsPage.production.filters.reset')}
          </Button>
          <Button type="submit" size="sm" disabled={isFetching}>
            {isFetching ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('usageLogsPage.production.filters.apply')}
          </Button>
        </div>
      </div>

      {optionCount === 0 ? (
        <p className="text-muted-foreground mt-3 text-xs leading-5">
          {t('usageLogsPage.production.filters.noOptions')}
        </p>
      ) : null}
    </form>
  )
}

function UsageProductionAnalyticsPanel({ overview }: { overview: UsageAnalyticsOverview }) {
  const { t } = useTranslation()
  const summary = overview.summary
  const rangeText =
    summary.start && summary.end
      ? t('usageLogsPage.production.header.range', {
          start: formatDateTime(summary.start),
          end: formatDateTime(summary.end),
        })
      : t('usageLogsPage.production.header.rangeUnavailable')

  return (
    <div className="grid gap-4">
      <div className="bg-card rounded-lg border p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <UsageSectionHeader
            title={t('usageLogsPage.production.header.title')}
            description={t('usageLogsPage.production.header.description')}
          />
          <span className="border-primary/30 bg-primary/10 text-primary inline-flex self-start rounded-md border px-2.5 py-1 text-xs font-medium">
            {t('usageLogsPage.production.header.badge')}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {rangeText}
          </span>
          <span className="border-success/30 bg-success/10 text-success rounded-md border px-2.5 py-1 text-xs">
            {t('usageLogsPage.production.header.successRate', {
              value: formatPercent(summary.successRate),
            })}
          </span>
          <span
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs',
              summary.failedRecords > 0
                ? 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {t('usageLogsPage.production.header.failureRate', {
              value: formatPercent(summary.failureRate),
            })}
          </span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <UsageProductionTrendPanel overview={overview} />
        <UsageProductionTokenPanel overview={overview} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <UsageProductionActivityPanel overview={overview} />
        <UsageProductionExceptionPanel overview={overview} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <UsageProductionDistributionList
          title={t('usageLogsPage.production.distributions.providers')}
          description={t('usageLogsPage.production.distributions.providersDescription')}
          items={overview.distributions.providers}
          total={summary.totalRecords}
          empty={t('usageLogsPage.production.distributions.empty')}
        />
        <UsageProductionDistributionList
          title={t('usageLogsPage.production.distributions.endpoints')}
          description={t('usageLogsPage.production.distributions.endpointsDescription')}
          items={overview.distributions.endpoints}
          total={summary.totalRecords}
          empty={t('usageLogsPage.production.distributions.empty')}
        />
      </div>

      <UsageProductionRankingPanel overview={overview} />
    </div>
  )
}

function formatUsageRequestTimestamp(value: string | null) {
  return value ? formatDateTime(value) : null
}

function getUsageRequestDisplayId(record: UsageRequestRecord) {
  return record.requestId ?? record.id
}

function UsageRequestStatusBadge({ record }: { record: UsageRequestRecord }) {
  const { t } = useTranslation()
  const statusKey = getUsageRequestStatusKey(record)

  return (
    <span
      className={cn(
        'inline-flex rounded-md border px-2 py-1 text-xs font-medium',
        getUsageRequestStatusClassName(record),
      )}
    >
      {t(`usageLogsPage.production.requests.status.${statusKey}`)}
    </span>
  )
}

function UsageRequestRecordsPanel({
  recordsPage,
  page,
  pending,
  fetching,
  error,
  errorMessage,
  canDownloadRequestLog,
  downloadingRequestLogId,
  isDownloadingRequestLog,
  mutating,
  onView,
  onDownloadRequestLog,
  onPreviousPage,
  onNextPage,
}: {
  recordsPage: UsageRequestRecordsPage | null
  page: number
  pending: boolean
  fetching: boolean
  error: boolean
  errorMessage: string | null
  canDownloadRequestLog: boolean
  downloadingRequestLogId: string | null
  isDownloadingRequestLog: boolean
  mutating: boolean
  onView: (record: UsageRequestRecord) => void
  onDownloadRequestLog: (requestId: string) => void
  onPreviousPage: () => void
  onNextPage: () => void
}) {
  const { t } = useTranslation()
  const records = recordsPage?.records ?? []
  const currentPage = recordsPage?.page ?? page
  const totalPages = recordsPage?.totalPages ?? 1
  const total = recordsPage?.total ?? 0
  const disablePrevious = pending || fetching || mutating || currentPage <= 1
  const disableNext = pending || fetching || mutating || !(recordsPage?.hasNextPage ?? false)

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <UsageSectionHeader
          title={t('usageLogsPage.production.requests.title')}
          description={t('usageLogsPage.production.requests.description')}
        />
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('usageLogsPage.production.requests.pageMeta', {
              page: currentPage,
              totalPages,
              total,
            })}
          </span>
          {fetching ? (
            <span className="border-info/30 bg-info/10 text-info inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs">
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              {t('usageLogsPage.production.requests.loading')}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-md border">
        {pending ? (
          <div className="grid gap-3 p-3">
            <Skeleton className="h-14 rounded-md" />
            <Skeleton className="h-14 rounded-md" />
            <Skeleton className="h-14 rounded-md" />
          </div>
        ) : error ? (
          <div className="text-muted-foreground px-4 py-10 text-sm">
            <p className="text-foreground font-medium">
              {t('usageLogsPage.production.requests.error')}
            </p>
            <p className="mt-1">{errorMessage ?? t('usageLogsPage.production.requests.empty')}</p>
          </div>
        ) : records.length === 0 ? (
          <div className="text-muted-foreground px-4 py-10 text-sm">
            {t('usageLogsPage.production.requests.empty')}
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-3 lg:hidden">
              {records.map((record) => {
                const requestId = record.requestId
                const displayId = getUsageRequestDisplayId(record)
                const downloading =
                  isDownloadingRequestLog &&
                  Boolean(requestId) &&
                  downloadingRequestLogId === requestId

                return (
                  <div key={record.id} className="min-w-0 rounded-md border px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs" title={displayId}>
                          {displayId}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {formatUsageRequestTimestamp(record.timestamp) ??
                            t('usageLogsPage.production.requests.notAvailable')}
                        </p>
                      </div>
                      <UsageRequestStatusBadge record={record} />
                    </div>
                    <div className="mt-3 grid gap-2 text-sm">
                      <div className="min-w-0">
                        <span className="text-muted-foreground">
                          {t('usageLogsPage.production.requests.columns.user')}
                        </span>
                        <p className="mt-0.5 truncate font-medium">
                          {record.userLabel ??
                            record.apiKeyDescription ??
                            t('usageLogsPage.production.requests.notAvailable')}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="min-w-0">
                          <span className="text-muted-foreground">
                            {t('usageLogsPage.production.requests.columns.provider')}
                          </span>
                          <p className="mt-0.5 truncate">
                            {record.provider ?? t('usageLogsPage.production.requests.notAvailable')}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <span className="text-muted-foreground">
                            {t('usageLogsPage.production.requests.columns.endpoint')}
                          </span>
                          <p className="mt-0.5 truncate font-mono text-xs">
                            {record.endpoint ?? t('usageLogsPage.production.requests.notAvailable')}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">
                            {t('usageLogsPage.production.requests.columns.tokens')}
                          </span>
                          <p className="mt-0.5 font-mono">
                            {formatCompactNumber(record.totalTokens)}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            {t('usageLogsPage.production.requests.columns.cost')}
                          </span>
                          <p className="mt-0.5 font-mono">
                            {formatCurrency(record.estimatedCostUsd)}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            {t('usageLogsPage.production.requests.columns.latency')}
                          </span>
                          <p className="mt-0.5 font-mono">
                            {formatOptionalDuration(record.latencyMs) ??
                              t('usageLogsPage.production.requests.notAvailable')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2 border-t pt-2">
                      <Button variant="text" size="sm" onClick={() => onView(record)}>
                        <FileSearch className="size-4" aria-hidden="true" />
                        {t('usageLogsPage.production.requests.view')}
                      </Button>
                      {requestId ? (
                        <Button
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
                          {t('usageLogsPage.production.requests.downloadLog')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <Table className="min-w-[1180px]">
                <TableHeader className="bg-muted/70 text-muted-foreground">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[240px]">
                      {t('usageLogsPage.production.requests.columns.request')}
                    </TableHead>
                    <TableHead className="w-[220px]">
                      {t('usageLogsPage.production.requests.columns.user')}
                    </TableHead>
                    <TableHead className="w-[220px]">
                      {t('usageLogsPage.production.requests.columns.provider')}
                    </TableHead>
                    <TableHead className="w-[150px]">
                      {t('usageLogsPage.production.requests.columns.endpoint')}
                    </TableHead>
                    <TableHead className="w-[110px]">
                      {t('usageLogsPage.production.requests.columns.status')}
                    </TableHead>
                    <TableHead className="w-[110px] text-right">
                      {t('usageLogsPage.production.requests.columns.tokens')}
                    </TableHead>
                    <TableHead className="w-[110px] text-right">
                      {t('usageLogsPage.production.requests.columns.cost')}
                    </TableHead>
                    <TableHead className="w-[110px] text-right">
                      {t('usageLogsPage.production.requests.columns.latency')}
                    </TableHead>
                    <TableHead className="w-[170px] text-right">
                      {t('usageLogsPage.production.requests.columns.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => {
                    const requestId = record.requestId
                    const displayId = getUsageRequestDisplayId(record)
                    const downloading =
                      isDownloadingRequestLog &&
                      Boolean(requestId) &&
                      downloadingRequestLogId === requestId

                    return (
                      <TableRow key={record.id} className="align-top">
                        <TableCell className="max-w-[240px]">
                          <p className="truncate font-mono text-xs" title={displayId}>
                            {displayId}
                          </p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            {formatUsageRequestTimestamp(record.timestamp) ??
                              t('usageLogsPage.production.requests.notAvailable')}
                          </p>
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <p className="truncate">
                            {record.userLabel ??
                              t('usageLogsPage.production.requests.notAvailable')}
                          </p>
                          <p className="text-muted-foreground mt-1 truncate text-xs">
                            {record.apiKeyDescription ??
                              t('usageLogsPage.production.requests.notAvailable')}
                          </p>
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <p className="truncate">
                            {record.provider ?? t('usageLogsPage.production.requests.notAvailable')}
                          </p>
                          <p className="text-muted-foreground mt-1 truncate font-mono text-xs">
                            {record.model ?? t('usageLogsPage.production.requests.notAvailable')}
                          </p>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[150px] truncate font-mono text-xs">
                          {record.endpoint ?? t('usageLogsPage.production.requests.notAvailable')}
                        </TableCell>
                        <TableCell>
                          <UsageRequestStatusBadge record={record} />
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatCompactNumber(record.totalTokens)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatCurrency(record.estimatedCostUsd)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatOptionalDuration(record.latencyMs) ??
                            t('usageLogsPage.production.requests.notAvailable')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="text" size="sm" onClick={() => onView(record)}>
                              <FileSearch className="size-4" aria-hidden="true" />
                              {t('usageLogsPage.production.requests.view')}
                            </Button>
                            {requestId ? (
                              <Button
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
                                {t('usageLogsPage.production.requests.downloadLog')}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs">
          {t('usageLogsPage.production.requests.pageMeta', {
            page: currentPage,
            totalPages,
            total,
          })}
        </p>
        <div className="flex gap-2 sm:shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disablePrevious}
            onClick={onPreviousPage}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {t('usageLogsPage.production.requests.previous')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disableNext}
            onClick={onNextPage}
          >
            {t('usageLogsPage.production.requests.next')}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function UsageRequestDetailRow({ label, value }: { label: string; value: string | null }) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-1 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd className="min-w-0 text-sm break-words">
        {value ?? t('usageLogsPage.production.requests.notAvailable')}
      </dd>
    </div>
  )
}

function UsageRequestRecordDetailSheet({
  open,
  record,
  detail,
  loading,
  canDownloadRequestLog,
  downloadingRequestLogId,
  isDownloadingRequestLog,
  mutating,
  onOpenChange,
  onDownloadRequestLog,
}: {
  open: boolean
  record: UsageRequestRecord | null
  detail: UsageRequestRecordDetail | null
  loading: boolean
  canDownloadRequestLog: boolean
  downloadingRequestLogId: string | null
  isDownloadingRequestLog: boolean
  mutating: boolean
  onOpenChange: (open: boolean) => void
  onDownloadRequestLog: (requestId: string) => void
}) {
  const { t } = useTranslation()
  const detailMatchesRecord = Boolean(record && detail?.record.id === record.id)
  const displayRecord = detailMatchesRecord ? detail?.record : record
  const raw = detailMatchesRecord ? detail?.raw : displayRecord?.raw
  const requestId = displayRecord?.requestId ?? null
  const downloading =
    isDownloadingRequestLog && Boolean(requestId) && downloadingRequestLogId === requestId

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden p-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{t('usageLogsPage.production.requests.detail.title')}</SheetTitle>
          <SheetDescription>
            {displayRecord
              ? t('usageLogsPage.production.requests.detail.description', {
                  request: getUsageRequestDisplayId(displayRecord),
                })
              : t('usageLogsPage.production.requests.detail.unavailable')}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {displayRecord ? (
            <div className="grid gap-4 p-4">
              <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p
                    className="truncate font-mono text-sm"
                    title={getUsageRequestDisplayId(displayRecord)}
                  >
                    {getUsageRequestDisplayId(displayRecord)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {formatUsageRequestTimestamp(displayRecord.timestamp) ??
                      t('usageLogsPage.production.requests.notAvailable')}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:shrink-0">
                  <UsageRequestStatusBadge record={displayRecord} />
                  {requestId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canDownloadRequestLog || mutating}
                      onClick={() => onDownloadRequestLog(requestId)}
                    >
                      {downloading ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Download className="size-4" aria-hidden="true" />
                      )}
                      {t('usageLogsPage.production.requests.downloadLog')}
                    </Button>
                  ) : null}
                </div>
              </div>

              {loading ? (
                <div className="grid gap-2">
                  <Skeleton className="h-10 rounded-md" />
                  <Skeleton className="h-10 rounded-md" />
                </div>
              ) : null}

              <dl className="overflow-hidden rounded-md border">
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.requestId')}
                  value={displayRecord.requestId}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.timestamp')}
                  value={formatUsageRequestTimestamp(displayRecord.timestamp)}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.user')}
                  value={displayRecord.userLabel}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.clientKey')}
                  value={displayRecord.apiKeyDescription}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.provider')}
                  value={displayRecord.provider}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.model')}
                  value={displayRecord.model}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.endpoint')}
                  value={displayRecord.endpoint}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.status')}
                  value={t(
                    `usageLogsPage.production.requests.status.${getUsageRequestStatusKey(
                      displayRecord,
                    )}`,
                  )}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.totalTokens')}
                  value={formatFullNumber(displayRecord.totalTokens)}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.inputTokens')}
                  value={formatFullNumber(displayRecord.inputTokens)}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.outputTokens')}
                  value={formatFullNumber(displayRecord.outputTokens)}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.cachedTokens')}
                  value={formatFullNumber(displayRecord.cachedTokens)}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.cacheReadTokens')}
                  value={formatFullNumber(displayRecord.cacheReadTokens)}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.cacheCreationTokens')}
                  value={formatFullNumber(displayRecord.cacheCreationTokens)}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.reasoningTokens')}
                  value={formatFullNumber(displayRecord.reasoningTokens)}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.cost')}
                  value={formatCurrency(displayRecord.estimatedCostUsd)}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.latency')}
                  value={formatOptionalDuration(displayRecord.latencyMs)}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.firstTokenLatency')}
                  value={formatOptionalDuration(displayRecord.firstTokenLatencyMs)}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.sourceKey')}
                  value={displayRecord.sourceKey}
                />
                <UsageRequestDetailRow
                  label={t('usageLogsPage.production.requests.detail.fields.errorMessage')}
                  value={displayRecord.errorMessage}
                />
              </dl>

              <Collapsible className="rounded-md border">
                <CollapsibleTrigger className="group hover:bg-muted/60 focus-visible:ring-ring/50 flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium outline-none focus-visible:ring-[3px]">
                  {t('usageLogsPage.production.requests.detail.raw')}
                  <ChevronDown
                    className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180"
                    aria-hidden="true"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="bg-muted/40 max-h-96 overflow-auto border-t p-3 font-mono text-xs leading-5 whitespace-pre-wrap">
                    {formatRawRecord(raw)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            </div>
          ) : (
            <div className="text-muted-foreground p-4 text-sm">
              {t('usageLogsPage.production.requests.detail.unavailable')}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function UsageMockScenarioSwitcher({
  activeScenario,
}: {
  activeScenario: UsageAnalyticsScenarioId
}) {
  const { t } = useTranslation()

  return (
    <div className="bg-muted/40 flex flex-wrap gap-1.5 rounded-md border p-1">
      {usageAnalyticsScenarioIds.map((scenarioId) => (
        <Button
          key={scenarioId}
          asChild
          variant={scenarioId === activeScenario ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs',
            scenarioId === activeScenario
              ? 'bg-background shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
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
        <div className="min-w-0 xl:shrink-0">
          <p className="text-muted-foreground mb-1 text-xs font-medium">
            {t('usageLogsPage.mock.validationToolbar')}
          </p>
          <UsageMockScenarioSwitcher activeScenario={snapshot.scenarioId} />
        </div>
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
      <div className="border-info/30 bg-info/10 text-info mt-4 rounded-md border px-3 py-2.5 text-sm leading-6">
        {t('usageLogsPage.mock.contractNotice')}
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
      tone: summary.failed > 0 ? 'warning' : 'neutral',
    },
    {
      id: 'tokens',
      value: formatCompactNumber(summary.totalTokens),
      detail: t('usageLogsPage.mock.kpis.tokensDetail', {
        input: formatCompactNumber(summary.inputTokens),
        output: formatCompactNumber(summary.outputTokens),
      }),
      tone: 'neutral',
    },
    {
      id: 'cost',
      value: formatCurrency(summary.cost),
      detail: t('usageLogsPage.mock.kpis.costDetail', {
        count: formatCompactNumber(summary.unpricedRequests),
      }),
      tone: summary.unpricedRequests > 0 ? 'warning' : 'neutral',
    },
    {
      id: 'latency',
      value: formatDuration(summary.avgDurationMs),
      detail: t('usageLogsPage.mock.kpis.latencyDetail', {
        firstToken: formatDuration(summary.avgFirstTokenMs),
      }),
      tone: summary.avgDurationMs > 2500 ? 'warning' : 'neutral',
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

function UsageMockComparisonPanel({ comparisons }: { comparisons: UsageAnalyticsComparison[] }) {
  const { t } = useTranslation()

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <UsageSectionHeader
        title={t('usageLogsPage.mock.comparisons.title')}
        description={t('usageLogsPage.mock.comparisons.description')}
      />
      <div className="mt-4 grid gap-2">
        {comparisons.map((comparison) => {
          const maxValue = Math.max(comparison.current, comparison.previous, 1)
          const currentWidth = Math.max(
            (comparison.current / maxValue) * 100,
            comparison.current > 0 ? 4 : 0,
          )

          return (
            <div
              key={comparison.id}
              className="grid min-w-0 gap-3 rounded-md border px-3 py-2.5 md:grid-cols-[minmax(9rem,0.9fr)_minmax(0,1.3fr)_auto]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {t(`usageLogsPage.mock.comparisons.${comparison.id}`)}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t('usageLogsPage.mock.comparisons.meta', {
                    current: formatComparisonValue(comparison.id, comparison.current),
                    previous: formatComparisonValue(comparison.id, comparison.previous),
                  })}
                </p>
              </div>
              <div className="bg-muted min-w-0 self-center overflow-hidden rounded-full">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${currentWidth}%` }}
                />
              </div>
              <span
                className={cn(
                  'self-start rounded-md border px-2 py-1 text-xs font-medium md:self-center',
                  comparison.favorable
                    ? 'bg-muted text-muted-foreground'
                    : 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning',
                )}
              >
                {comparison.deltaPercent > 0 ? '+' : ''}
                {comparison.deltaPercent}%
              </span>
            </div>
          )
        })}
      </div>
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
  const isMobile = useIsMobile()
  const chartData = rows.slice(0, 8).map((row) => ({
    label: row.label,
    shortLabel: truncateMiddle(row.label, 18),
    requests: row.requests,
    failed: row.failed,
    tokens: row.totalTokens,
    cost: row.cost,
  }))

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <UsageSectionHeader title={title} description={description} />
      {!isMobile ? (
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
                  dataKey="shortLabel"
                  tickLine={false}
                  axisLine={false}
                  width={132}
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
      ) : null}
      <div className={cn('mt-4 min-w-0 gap-3', isMobile ? 'grid' : 'hidden')}>
        {chartData.length > 0 ? (
          chartData.map((row) => {
            const maxValue = Math.max(...chartData.map((item) => item.requests), 1)
            const width = Math.max((row.requests / maxValue) * 100, row.requests > 0 ? 4 : 0)

            return (
              <div
                key={row.label}
                className="min-w-0 overflow-hidden rounded-md border px-3 py-2.5"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={row.label}>
                      {row.label}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t('usageLogsPage.mock.breakdown.mobileMeta', {
                        requests: formatCompactNumber(row.requests),
                        failed: formatCompactNumber(row.failed),
                      })}
                    </p>
                  </div>
                  <span className="font-mono text-xs">{formatCompactNumber(row.requests)}</span>
                </div>
                <div className="bg-muted mt-2 h-2 min-w-0 overflow-hidden rounded-full">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${width}%` }} />
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-muted-foreground rounded-md border px-4 py-8 text-center text-sm">
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
          <>
            <div className="grid gap-3 p-3 lg:hidden">
              {snapshot.requestSamples.map((row) => (
                <div key={row.requestId} className="rounded-md border px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs" title={row.requestId}>
                        {row.requestId}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatDateTime(row.timestamp)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-md border px-2 py-1 text-xs font-medium',
                        usageStatusClassNames[row.status],
                      )}
                    >
                      {t(getStatusKey(row.status))}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="min-w-0">
                      <span className="text-muted-foreground">
                        {t('usageLogsPage.mock.requests.columns.provider')}
                      </span>
                      <p className="mt-0.5 truncate font-medium" title={row.provider}>
                        {row.provider}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground">
                        {t('usageLogsPage.mock.requests.columns.model')}
                      </span>
                      <p className="mt-0.5 truncate font-mono text-xs" title={row.model}>
                        {row.model}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">
                          {t('usageLogsPage.mock.requests.columns.tokens')}
                        </span>
                        <p className="mt-0.5 font-mono">{formatCompactNumber(row.totalTokens)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {t('usageLogsPage.mock.requests.columns.cost')}
                        </span>
                        <p className="mt-0.5 font-mono">{formatCurrency(row.cost)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {t('usageLogsPage.mock.requests.columns.latency')}
                        </span>
                        <p className="mt-0.5 font-mono">{formatDuration(row.durationMs)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto lg:block">
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
          </>
        ) : (
          <p className="text-muted-foreground px-4 py-10 text-sm">
            {t('usageLogsPage.mock.requests.empty')}
          </p>
        )}
      </div>
    </div>
  )
}

function UsageMockEmptyState({ snapshot }: { snapshot: UsageAnalyticsSnapshot }) {
  const { t } = useTranslation()
  const previewKeys = ['trend', 'breakdown', 'requests'] as const

  return (
    <div className="bg-card rounded-lg border p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-md border">
          <BarChart3 className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t('usageLogsPage.mock.emptyState.title')}</h2>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
            {t('usageLogsPage.mock.emptyState.description', {
              scenario: t(getScenarioKey(snapshot.scenarioId)),
            })}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {previewKeys.map((key) => (
          <div key={key} className="bg-muted/30 rounded-md border px-3 py-3">
            <p className="text-sm font-medium">{t(`usageLogsPage.mock.emptyState.${key}.title`)}</p>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {t(`usageLogsPage.mock.emptyState.${key}.description`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function UsageMockBreakdownSection({ snapshot }: { snapshot: UsageAnalyticsSnapshot }) {
  const { t } = useTranslation()

  return (
    <Collapsible className="grid gap-3">
      <div className="bg-card rounded-lg border p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <UsageSectionHeader
            title={t('usageLogsPage.mock.breakdownSection.title')}
            description={t('usageLogsPage.mock.breakdownSection.description')}
          />
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="group md:shrink-0">
              <ChevronDown
                className="size-4 transition-transform group-data-[state=open]:rotate-180"
                aria-hidden="true"
              />
              {t('usageLogsPage.mock.breakdownSection.trigger')}
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent className="grid gap-4 xl:grid-cols-2">
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
      </CollapsibleContent>
    </Collapsible>
  )
}

function UsageMockAnalyticsLab({ snapshot }: { snapshot: UsageAnalyticsSnapshot }) {
  if (snapshot.summary.requests === 0) {
    return (
      <section className="grid w-full gap-4">
        <UsageMockHeader snapshot={snapshot} />
        <UsageMockEmptyState snapshot={snapshot} />
      </section>
    )
  }

  return (
    <section className="grid w-full gap-4">
      <UsageMockHeader snapshot={snapshot} />
      <UsageMockKpis snapshot={snapshot} />
      <UsageMockComparisonPanel comparisons={snapshot.comparisons} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <UsageMockTrendChart snapshot={snapshot} />
        <UsageMockStatusChart snapshot={snapshot} />
      </div>
      <UsageMockBreakdownSection snapshot={snapshot} />
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

function UsageAnalyticsPreviewPanel({ analytics }: { analytics: UsageAnalyticsModel }) {
  const { t } = useTranslation()

  return (
    <Collapsible className="grid gap-3">
      <div className="bg-card rounded-lg border p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md border">
              <Filter className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">
                {t('usageLogsPage.analytics.preview.title')}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                {t('usageLogsPage.analytics.preview.description')}
              </p>
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="group md:shrink-0">
              <ChevronDown
                className="size-4 transition-transform group-data-[state=open]:rotate-180"
                aria-hidden="true"
              />
              {t('usageLogsPage.analytics.preview.trigger')}
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent className="grid gap-3">
        <UsageScopeNotice />
        <UsageFilterPreview />
        <UsageCapabilityRoadmap analytics={analytics} />
      </CollapsibleContent>
    </Collapsible>
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
    <Collapsible className="bg-card rounded-lg border p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
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
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="group md:shrink-0">
            <ChevronDown
              className="size-4 transition-transform group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
            {t('usageLogsPage.trace.trigger')}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
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
          <p className="text-muted-foreground mt-3 text-sm">
            {t('usageLogsPage.trace.unavailable')}
          </p>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
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
  const [filterDraft, setFilterDraft] = useState(defaultUsageFilterDraft)
  const [appliedFilters, setAppliedFilters] = useState(() =>
    createUsageAnalyticsFilters(defaultUsageFilterDraft),
  )
  const [usageRecordsPage, setUsageRecordsPage] = useState(1)
  const [selectedUsageRecord, setSelectedUsageRecord] = useState<UsageRequestRecord | null>(null)
  const [usageRecordDetailOpen, setUsageRecordDetailOpen] = useState(false)
  const workbench = useUsageLogsWorkbench(appliedFilters, usageRecordsPage, 20)
  const [clearLogsDialogOpen, setClearLogsDialogOpen] = useState(false)
  const capabilities = workbench.capabilities
  const noRuntimeLogCapabilities =
    !capabilities.usageAnalytics &&
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
    overview: workbench.snapshot.analyticsOverview,
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

  const handleApplyFilters = () => {
    setUsageRecordsPage(1)
    setAppliedFilters(createUsageAnalyticsFilters(filterDraft))
  }

  const handleResetFilters = () => {
    setUsageRecordsPage(1)
    setFilterDraft(defaultUsageFilterDraft)
    setAppliedFilters(createUsageAnalyticsFilters(defaultUsageFilterDraft))
  }

  const handleOpenUsageRecord = async (record: UsageRequestRecord) => {
    setSelectedUsageRecord(record)
    setUsageRecordDetailOpen(true)

    try {
      await workbench.fetchUsageRequestRecordDetail(record.id)
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

      <UsageMetricCards analytics={analytics} />

      {workbench.snapshot.analyticsOverview ? (
        <>
          <UsageProductionFilterBar
            draft={filterDraft}
            options={workbench.snapshot.analyticsOptions}
            isFetching={workbench.isFetching}
            onChange={setFilterDraft}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
          />
          <UsageProductionAnalyticsPanel overview={workbench.snapshot.analyticsOverview} />
          <UsageRequestRecordsPanel
            recordsPage={workbench.usageRequestRecords}
            page={usageRecordsPage}
            pending={workbench.isUsageRequestRecordsPending}
            fetching={workbench.isFetchingUsageRequestRecords}
            error={workbench.isUsageRequestRecordsError}
            errorMessage={workbench.usageRequestRecordsErrorMessage}
            canDownloadRequestLog={capabilities.requestErrorLogs}
            downloadingRequestLogId={workbench.downloadingRequestLogId}
            isDownloadingRequestLog={workbench.isDownloadingRequestLog}
            mutating={workbench.mutating}
            onView={(record) => void handleOpenUsageRecord(record)}
            onDownloadRequestLog={(requestId) => void handleDownloadRequestLog(requestId)}
            onPreviousPage={() => setUsageRecordsPage((page) => Math.max(page - 1, 1))}
            onNextPage={() => setUsageRecordsPage((page) => page + 1)}
          />
        </>
      ) : (
        <>
          <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
            <UsageSectionHeader
              title={t('usageLogsPage.usage.title')}
              description={t('usageLogsPage.usage.description')}
            />
            <div className="mt-3">
              <ApiKeyUsageTable resources={workbench.snapshot.apiKeyUsage} />
            </div>
          </div>

          {analytics.providerBreakdown.length > 0 ? (
            <UsageProviderCharts analytics={analytics} />
          ) : null}

          <UsageAnalyticsPreviewPanel analytics={analytics} />
        </>
      )}

      {workbench.snapshot.analyticsOverview && workbench.snapshot.apiKeyUsage.length > 0 ? (
        <Collapsible className="grid gap-3">
          <div className="bg-card rounded-lg border p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <UsageSectionHeader
                title={t('usageLogsPage.usage.compatTitle')}
                description={t('usageLogsPage.usage.compatDescription')}
              />
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="group md:shrink-0">
                  <ChevronDown
                    className="size-4 transition-transform group-data-[state=open]:rotate-180"
                    aria-hidden="true"
                  />
                  {t('usageLogsPage.usage.compatTrigger')}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <CollapsibleContent>
            <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
              <ApiKeyUsageTable resources={workbench.snapshot.apiKeyUsage} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <UsageSectionHeader
        title={t('usageLogsPage.operations.title')}
        description={t('usageLogsPage.operations.description')}
      />

      <div className="grid gap-4">
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
        <RequestTraceLookup
          canDownloadRequestLog={capabilities.requestErrorLogs}
          downloadingRequestLogId={workbench.downloadingRequestLogId}
          isDownloadingRequestLog={workbench.isDownloadingRequestLog}
          mutating={workbench.mutating}
          onDownloadRequestLog={(requestId) => void handleDownloadRequestLog(requestId)}
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

      <UsageRequestRecordDetailSheet
        open={usageRecordDetailOpen}
        record={selectedUsageRecord}
        detail={workbench.usageRequestRecordDetail}
        loading={workbench.isFetchingUsageRequestRecordDetail}
        canDownloadRequestLog={capabilities.requestErrorLogs}
        downloadingRequestLogId={workbench.downloadingRequestLogId}
        isDownloadingRequestLog={workbench.isDownloadingRequestLog}
        mutating={workbench.mutating}
        onOpenChange={setUsageRecordDetailOpen}
        onDownloadRequestLog={(requestId) => void handleDownloadRequestLog(requestId)}
      />
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
