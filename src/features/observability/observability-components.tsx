import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'

import type { i18n as I18nInstance, TFunction } from 'i18next'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  ChevronsUpDown,
  CircleDollarSign,
  CirclePile,
  Columns3,
  Download,
  Eye,
  Hash,
  HeartPulse,
  List,
  Loader2,
  Minus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DateTimeRangePicker } from '@/components/shared/date-time-range-picker'
import { DiagnosticDetailField, TechnicalTextViewer } from '@/components/shared/diagnostic-detail'
import { TableEmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { ProviderLogo } from '@/components/shared/provider-logo'
import { SelectInputGroup } from '@/components/shared/select-input-group'
import {
  TablePaginationStatus,
  TableSurface,
  containedTableContainerClassName,
  stickyTableHeaderClassName,
} from '@/components/shared/table-surface'
import {
  UsageActivityMatrix,
  type UsageActivityMatrixBucket,
} from '@/components/shared/usage-activity-matrix'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { LiveRefreshPauseReason } from '@/features/observability/live-refresh'
import {
  LiveRefreshControl,
  LiveRefreshStatusNotice,
  NewItemsNotice,
} from '@/features/observability/live-refresh-control'
import type { RuntimeMode } from '@/lib/api/management/types'
import { defaultRuntimeLogFilters, defaultUsageFilters } from '@/lib/api/management/usage-logs'
import type {
  ApiKeyUsageResource,
  RequestErrorLogFile,
  RequestLogIndex,
  RuntimeLogFilters,
  RuntimeLogLevelFilter,
  RuntimeLogRecord,
  RuntimeLogSnapshot,
  UsageAggregateGroupBy,
  UsageAggregateItem,
  UsageAggregateMetric,
  UsageAggregateResponse,
  UsageAggregateSortState,
  UsageCredentialType,
  UsageExecutionCredential,
  UsageFilterOptions,
  UsageFilters,
  UsageHealthResponse,
  UsageHealthStatus,
  UsageLogIssue,
  UsageLogsSnapshot,
  UsageOverview,
  UsageQuotaWindow,
  UsageRealtimeSnapshot,
  UsageRecord,
  UsageRecordDetail,
  UsageRecordSortableField,
  UsageRecordsPage,
} from '@/lib/api/management/usage-logs'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type UsageVerdict = 'ready' | 'partial' | 'legacy' | 'logsOnly' | 'disabled' | 'unsupported'
type KpiTone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info'
type KpiComparisonMode = 'increaseGood' | 'increaseBad'
type KpiCardData = {
  key: string
  labelKey: string
  value: string
  icon: ReactNode
  sparkline: number[]
  comparisonDelta: number | null
  comparisonMode?: KpiComparisonMode
  tone: KpiTone
}

function getDateTimeLocale(i18n: I18nInstance) {
  return i18n.resolvedLanguage ?? i18n.language
}

function getNumberLocale() {
  if (typeof document === 'undefined') return undefined
  const language = document.documentElement.lang?.trim()
  return language || undefined
}

export function formatDateTime(value: string | null, i18n: I18nInstance) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(getDateTimeLocale(i18n), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatHomeEndpoint(homeIp: string | null, homePort?: number | null) {
  if (!homeIp) return null
  return homePort ? `${homeIp}:${homePort}` : homeIp
}

function formatShortDateTime(value: string, i18n: I18nInstance) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(getDateTimeLocale(i18n), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
  }).format(date)
}

function formatTimestamp(value: number | null, i18n: I18nInstance) {
  if (value === null) return null
  const date = new Date(value < 1_000_000_000_000 ? value * 1000 : value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat(getDateTimeLocale(i18n), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(getNumberLocale(), { maximumFractionDigits: 0 }).format(value)
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(getNumberLocale(), {
    maximumFractionDigits: value >= 1000 ? 1 : 0,
    notation: value >= 10_000 ? 'compact' : 'standard',
  }).format(value)
}

function formatRateNumber(value: number) {
  return new Intl.NumberFormat(getNumberLocale(), {
    maximumFractionDigits: value < 100 ? 1 : 0,
  }).format(value)
}

function formatAmount(value: number | null) {
  if (value === null) return null
  const absoluteValue = Math.abs(value)
  const maximumFractionDigits = absoluteValue > 0 && absoluteValue < 1 ? 4 : 2
  const formattedAmount = new Intl.NumberFormat(getNumberLocale(), {
    maximumFractionDigits,
    minimumFractionDigits: 2,
  }).format(absoluteValue)

  return `${value < 0 ? '-' : ''}${formattedAmount}`
}

// Renders an API billing amount with its backend-declared unit.
// Returns null for a null value so callers can supply their own fallback copy.
function formatAmountUnit(t: TFunction, value: number | null, currency?: string | null) {
  if (value === null) return null

  const amount = formatAmount(value)

  const normalizedCurrency = currency?.trim().toLowerCase()
  if (!normalizedCurrency || normalizedCurrency === 'credits' || normalizedCurrency === 'points') {
    return t('usageLogsPage.kpi.amountValue', { value: amount })
  }

  if (normalizedCurrency === 'usd') {
    return new Intl.NumberFormat(getNumberLocale(), {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: Math.abs(value) > 0 && Math.abs(value) < 1 ? 4 : 2,
    }).format(value)
  }

  return `${amount} ${currency?.trim()}`
}

function formatKpiAmount(t: TFunction, value: number | null, currency?: string | null) {
  return formatAmountUnit(t, value, currency) ?? '—'
}

function formatBillingBasis(value: string | null, t: TFunction) {
  const normalized = value?.trim().toLowerCase()

  if (normalized === 'estimated') {
    return t('usageLogsPage.costBreakdown.billingBasis.estimated')
  }

  if (normalized === 'current') {
    return t('usageLogsPage.costBreakdown.billingBasis.current')
  }

  return value?.trim() || t('usageLogsPage.status.notAvailable')
}

function formatPercent(value: number) {
  return new Intl.NumberFormat(getNumberLocale(), {
    style: 'percent',
    maximumFractionDigits: value < 0.01 && value > 0 ? 2 : 1,
  }).format(value)
}

function formatDuration(value: number | null) {
  if (value === null) return null
  if (value < 1000) return `${formatNumber(value)} ms`
  return `${new Intl.NumberFormat(getNumberLocale(), { maximumFractionDigits: 1 }).format(
    value / 1000,
  )} s`
}

function formatBytes(value: number | null) {
  if (value === null) return null
  return new Intl.NumberFormat(getNumberLocale(), { maximumFractionDigits: 0 }).format(value)
}

function getRuntimeLogSummary(line: string) {
  const normalized = line
    .replace(/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\]\s*/, '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^\[(?:debug|info|warn|warning|error|fatal|panic)(?:\s*\]|\s*[|])\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

function getRuntimeLogLevel(record: RuntimeLogRecord) {
  const directLevel = record.level?.trim()
  if (directLevel) return directLevel

  const match = record.line.match(/\[(debug|info|warn|warning|error|fatal|panic)(?:\s*\]|\s*[|])/i)
  return match?.[1]?.toLowerCase() ?? null
}

export { downloadBlob } from '@/lib/download'

export function isFileLoggingDisabledError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes('logging to file disabled')
}

function getUsageTotals(resources: ApiKeyUsageResource[]) {
  return resources.reduce(
    (acc, resource) => ({
      success: acc.success + resource.success,
      failed: acc.failed + resource.failed,
      recentWindows: acc.recentWindows + resource.recentRequestCount,
    }),
    { success: 0, failed: 0, recentWindows: 0 },
  )
}

function getUsageVerdict(
  snapshot: UsageLogsSnapshot,
  runtimeHasAnyCapability: boolean,
): UsageVerdict {
  if (!snapshot.settings.usageStatisticsEnabled) return 'disabled'
  if (snapshot.issues.length > 0) return 'partial'
  if (snapshot.overview && snapshot.records) return 'ready'
  if (snapshot.apiKeyUsage.length > 0) return 'legacy'
  if (snapshot.runtimeLogs !== null || snapshot.requestErrorLogs.length > 0) return 'logsOnly'
  if (!runtimeHasAnyCapability) return 'unsupported'
  return 'partial'
}

type ObservabilityCopyKey = 'usagePage' | 'requestEventsPage' | 'callDiagnosticsPage' | 'logsPage'

// Shared verdict badge palette for the observability surfaces (usage, diagnostics, logs).
// Color carries the at-a-glance status, so every verdict gets a distinct tone; unknown
// verdicts fall back to the neutral/muted treatment rather than the brand accent.
const observabilityVerdictBadgeClassNames: Record<string, string> = {
  ready: 'border-success/30 bg-success/10 text-success',
  partial: 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning',
  empty: 'border-border bg-muted/50 text-muted-foreground',
  disabled: 'border-border bg-muted/50 text-muted-foreground',
  errorFilesOnly: 'border-info/30 bg-info/10 text-info',
  unsupported: 'border-border bg-muted/50 text-muted-foreground',
}

export function getObservabilityVerdictBadgeClassName(verdict: string) {
  return (
    observabilityVerdictBadgeClassNames[verdict] ?? observabilityVerdictBadgeClassNames.unsupported
  )
}

export function ObservabilityDisconnectedState({ copyKey }: { copyKey: ObservabilityCopyKey }) {
  const { t } = useTranslation()
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)

  return (
    <PageHeader
      title={t(`${copyKey}.disconnected.title`)}
      description={t(`${copyKey}.disconnected.description`)}
      actions={
        <Button onClick={openConnectionDialog}>{t(`${copyKey}.disconnected.action`)}</Button>
      }
    />
  )
}

export function ObservabilityLoadingState() {
  return (
    <section className="grid gap-4">
      <Skeleton className="h-36 rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.75fr)]">
        <Skeleton className="h-[360px] rounded-lg" />
        <Skeleton className="h-[360px] rounded-lg" />
      </div>
      <Skeleton className="h-[520px] rounded-lg" />
    </section>
  )
}

export function ObservabilityErrorState({
  copyKey,
  errorMessage,
  onRetry,
}: {
  copyKey: ObservabilityCopyKey
  errorMessage: string | null
  onRetry: () => void
}) {
  const { t } = useTranslation()

  return (
    <PageHeader
      title={t(`${copyKey}.error.title`)}
      description={errorMessage ?? t(`${copyKey}.error.description`)}
      actions={
        <Button onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {t(`${copyKey}.error.retry`)}
        </Button>
      }
    />
  )
}

export type CapabilityBadgeUnavailableTone = 'warning' | 'info'

export type CapabilityStripItem = {
  available: boolean
  label: string
  unavailableTone: CapabilityBadgeUnavailableTone
}

export function CapabilityBadge({
  available,
  label,
  unavailableTone = 'warning',
}: {
  available: boolean
  label: string
  unavailableTone?: CapabilityBadgeUnavailableTone
}) {
  const Icon = available ? CheckCircle2 : unavailableTone === 'warning' ? AlertTriangle : Minus

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
        available
          ? 'border-success/30 bg-success/10 text-success'
          : unavailableTone === 'warning'
            ? 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
            : 'border-info/30 bg-info/10 text-info dark:text-info',
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  )
}

export function CapabilityStrip({ items }: { items: CapabilityStripItem[] }) {
  const unavailableItems = items.filter((item) => !item.available)

  if (unavailableItems.length === 0) return null

  return (
    <>
      {unavailableItems.map((item) => (
        <CapabilityBadge
          key={item.label}
          available={item.available}
          label={item.label}
          unavailableTone={item.unavailableTone}
        />
      ))}
    </>
  )
}

export function UsageCapabilityStrip({
  capabilities,
}: {
  capabilities: {
    usage: boolean
    usageOverview: boolean
    usageRecords: boolean
    usageAggregates: boolean
    usageExport: boolean
    logs: boolean
    requestErrorLogs: boolean
  }
}) {
  const { t } = useTranslation()
  const capabilityItems: CapabilityStripItem[] = [
    {
      available: capabilities.usageOverview,
      label: t('usageLogsPage.capabilities.usageOverview'),
      unavailableTone: 'warning',
    },
    {
      available: capabilities.usageRecords,
      label: t('usageLogsPage.capabilities.usageRecords'),
      unavailableTone: 'warning',
    },
    {
      available: capabilities.usageAggregates,
      label: t('usageLogsPage.capabilities.usageAggregates'),
      unavailableTone: 'info',
    },
    {
      available: capabilities.usageExport,
      label: t('usageLogsPage.capabilities.usageExport'),
      unavailableTone: 'info',
    },
    {
      available: capabilities.logs,
      label: t('usageLogsPage.capabilities.logs'),
      unavailableTone: 'info',
    },
    {
      available: capabilities.requestErrorLogs,
      label: t('usageLogsPage.capabilities.requestErrorLogs'),
      unavailableTone: 'info',
    },
  ]
  return <CapabilityStrip items={capabilityItems} />
}

export function UsageVerdictHeader({
  snapshot,
  capabilities,
  runtimeMode,
  isFetching,
  isExporting,
  onRefresh,
  onExport,
}: {
  snapshot: UsageLogsSnapshot
  capabilities: {
    usage: boolean
    usageOverview: boolean
    usageRecords: boolean
    usageAggregates: boolean
    usageExport: boolean
    logs: boolean
    requestErrorLogs: boolean
  }
  runtimeMode: RuntimeMode
  isFetching: boolean
  isExporting: boolean
  onRefresh: () => void
  onExport: () => void
}) {
  const { t, i18n } = useTranslation()
  const runtimeHasAnyCapability =
    capabilities.usage ||
    capabilities.usageOverview ||
    capabilities.usageRecords ||
    capabilities.logs ||
    capabilities.requestErrorLogs
  const verdict = getUsageVerdict(snapshot, runtimeHasAnyCapability)

  return (
    <PageHeader
      title={t(`usageLogsPage.verdict.${verdict}.title`)}
      titleMeta={
        <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium">
          {t(`usageLogsPage.verdict.${verdict}.badge`)}
        </span>
      }
      description={t(`usageLogsPage.verdict.${verdict}.description`, {
        mode: t(`runtimeMode.${runtimeMode}`),
      })}
      meta={
        <>
          <span>
            {t('usageLogsPage.header.runtime', { mode: t(`runtimeMode.${runtimeMode}`) })}
          </span>
          <span>
            {t('usageLogsPage.header.updatedAt', {
              time: formatDateTime(snapshot.fetchedAt, i18n) ?? snapshot.fetchedAt,
            })}
          </span>
        </>
      }
      tags={<UsageCapabilityStrip capabilities={capabilities} />}
      actions={
        <>
          <Button
            variant="outline"
            disabled={!capabilities.usageExport || isExporting}
            onClick={onExport}
          >
            {isExporting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            {capabilities.usageExport
              ? t('usageLogsPage.actions.exportCsv')
              : t('usageLogsPage.actions.exportUnsupported')}
          </Button>
          <Button variant="outline" disabled={isFetching} onClick={onRefresh}>
            {isFetching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            {isFetching ? t('usageLogsPage.actions.syncing') : t('usageLogsPage.actions.refresh')}
          </Button>
        </>
      }
    />
  )
}

export function IssueList({ issues }: { issues: UsageLogIssue[] }) {
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

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="min-w-0">
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? (
        <p className="text-muted-foreground mt-1 text-sm leading-6">{description}</p>
      ) : null}
    </div>
  )
}

const usageFilterGridClassName = 'grid gap-2 sm:grid-cols-2 xl:grid-cols-3'
const usageTouchControlClassName = 'min-h-10 sm:min-h-8'
const usageTouchInputClassName = 'min-h-10 sm:h-8 sm:min-h-8'
const usageTouchButtonClassName = 'min-h-10 sm:min-h-8'
const runtimeLogLevelOptions: RuntimeLogLevelFilter[] = [
  'all',
  'trace',
  'debug',
  'info',
  'warn',
  'error',
]
type RuntimeLogSearchField = 'homeIp' | 'clientIp' | 'requestId'
const runtimeLogSearchFieldOptions: RuntimeLogSearchField[] = ['requestId', 'homeIp', 'clientIp']
const defaultRuntimeLogSearchField: RuntimeLogSearchField = 'requestId'
const requestRecordScopedFilterKeys: Array<keyof UsageFilters> = [
  'status',
  'executorType',
  'statusCode',
  'requestId',
  'user',
  'clientKey',
  'credentialId',
  'authIndex',
  'minLatencyMs',
  'maxLatencyMs',
  'minAmount',
  'maxAmount',
  'search',
]

function hasActiveRequestRecordFilters(filters: UsageFilters) {
  return requestRecordScopedFilterKeys.some((key) => filters[key] !== defaultUsageFilters[key])
}

function getClearedRequestRecordFilters(): Partial<UsageFilters> {
  return {
    status: defaultUsageFilters.status,
    executorType: defaultUsageFilters.executorType,
    statusCode: defaultUsageFilters.statusCode,
    requestId: defaultUsageFilters.requestId,
    user: defaultUsageFilters.user,
    clientKey: defaultUsageFilters.clientKey,
    credentialId: defaultUsageFilters.credentialId,
    authIndex: defaultUsageFilters.authIndex,
    minLatencyMs: defaultUsageFilters.minLatencyMs,
    maxLatencyMs: defaultUsageFilters.maxLatencyMs,
    minAmount: defaultUsageFilters.minAmount,
    maxAmount: defaultUsageFilters.maxAmount,
    search: defaultUsageFilters.search,
    sort: null,
    offset: 0,
  }
}

function hasActiveRuntimeLogFilters(filters: RuntimeLogFilters) {
  return (Object.keys(defaultRuntimeLogFilters) as Array<keyof RuntimeLogFilters>).some(
    (key) => filters[key] !== defaultRuntimeLogFilters[key],
  )
}

function getActiveRuntimeLogSearchField(filters: RuntimeLogFilters): RuntimeLogSearchField {
  return (
    runtimeLogSearchFieldOptions.find((field) => filters[field].trim()) ??
    defaultRuntimeLogSearchField
  )
}

export function UsageFiltersToolbar({
  filters,
  options,
  onChange,
}: {
  filters: UsageFilters
  options: UsageFilterOptions
  onChange: (nextFilters: Partial<UsageFilters>) => void
}) {
  const { t } = useTranslation()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const getDefaultCustomRange = () => {
    const to = new Date()
    const from = new Date(to)
    from.setDate(to.getDate() - 6)
    const formatDateInput = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    return {
      customFrom: formatDateInput(from),
      customTo: formatDateInput(to),
    }
  }

  const handleRangeChange = (range: UsageFilters['range']) => {
    if (range === 'custom' && !filters.customFrom && !filters.customTo) {
      onChange({ range, ...getDefaultCustomRange() })
      return
    }

    onChange({ range })
  }

  return (
    <Collapsible
      open={advancedOpen}
      onOpenChange={setAdvancedOpen}
      className="bg-card rounded-lg border p-3 shadow-sm"
    >
      <div className={usageFilterGridClassName}>
        <Select
          value={filters.range}
          onValueChange={(range) => handleRangeChange(range as UsageFilters['range'])}
        >
          <SelectTrigger
            className={usageTouchControlClassName}
            size="sm"
            aria-label={t('usageLogsPage.filters.range')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="4h">{t('usageLogsPage.filters.ranges.last4h')}</SelectItem>
            <SelectItem value="12h">{t('usageLogsPage.filters.ranges.last12h')}</SelectItem>
            <SelectItem value="24h">{t('usageLogsPage.filters.ranges.last24h')}</SelectItem>
            <SelectItem value="today">{t('usageLogsPage.filters.ranges.today')}</SelectItem>
            <SelectItem value="yesterday">{t('usageLogsPage.filters.ranges.yesterday')}</SelectItem>
            <SelectItem value="7d">{t('usageLogsPage.filters.ranges.last7d')}</SelectItem>
            <SelectItem value="30d">{t('usageLogsPage.filters.ranges.last30d')}</SelectItem>
            <SelectItem value="90d">{t('usageLogsPage.filters.ranges.last90d')}</SelectItem>
            <SelectItem value="custom">{t('usageLogsPage.filters.ranges.custom')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.provider} onValueChange={(provider) => onChange({ provider })}>
          <SelectTrigger
            className={usageTouchControlClassName}
            size="sm"
            aria-label={t('usageLogsPage.filters.provider')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('usageLogsPage.filters.anyProvider')}</SelectItem>
            {options.providers.map((provider) => (
              <SelectItem key={provider} value={provider}>
                {provider}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.model} onValueChange={(model) => onChange({ model })}>
          <SelectTrigger
            className={usageTouchControlClassName}
            size="sm"
            aria-label={t('usageLogsPage.filters.model')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('usageLogsPage.filters.anyModel')}</SelectItem>
            {options.models.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {filters.range === 'custom' ? (
        <div className={cn(usageFilterGridClassName, 'mt-3 border-t pt-3')}>
          <label className="grid gap-1.5 text-xs font-medium">
            <span className="text-muted-foreground">{t('usageLogsPage.filters.customFrom')}</span>
            <Input
              className={usageTouchInputClassName}
              type="date"
              value={filters.customFrom}
              onChange={(event) => onChange({ customFrom: event.target.value })}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium">
            <span className="text-muted-foreground">{t('usageLogsPage.filters.customTo')}</span>
            <Input
              className={usageTouchInputClassName}
              type="date"
              value={filters.customTo}
              onChange={(event) => onChange({ customTo: event.target.value })}
            />
          </label>
        </div>
      ) : null}
      <CollapsibleContent>
        <div className={cn(usageFilterGridClassName, 'mt-3 border-t pt-3')}>
          <Select
            value={filters.credentialType}
            onValueChange={(credentialType) =>
              onChange({ credentialType: credentialType as UsageFilters['credentialType'] })
            }
          >
            <SelectTrigger
              className={usageTouchControlClassName}
              size="sm"
              aria-label={t('usageLogsPage.filters.credentialType')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('usageLogsPage.filters.anyCredentialType')}</SelectItem>
              {options.credentialTypes.map((credentialType) => (
                <SelectItem key={credentialType} value={credentialType}>
                  {t(`usageLogsPage.credentialTypes.${credentialType}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.homeIp} onValueChange={(homeIp) => onChange({ homeIp })}>
            <SelectTrigger
              className={usageTouchControlClassName}
              size="sm"
              aria-label={t('usageLogsPage.filters.homeIp')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('usageLogsPage.filters.anyHomeIp')}</SelectItem>
              {options.homeIps.map((homeIp) => (
                <SelectItem key={homeIp} value={homeIp}>
                  {homeIp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.endpoint} onValueChange={(endpoint) => onChange({ endpoint })}>
            <SelectTrigger
              className={usageTouchControlClassName}
              size="sm"
              aria-label={t('usageLogsPage.filters.endpoint')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('usageLogsPage.filters.anyEndpoint')}</SelectItem>
              {options.endpoints.map((endpoint) => (
                <SelectItem key={endpoint} value={endpoint}>
                  {endpoint}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CollapsibleContent>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="border-border/80 bg-muted/20 text-muted-foreground hover:border-primary/35 hover:bg-primary/5 hover:text-foreground focus-visible:ring-ring mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none sm:h-9 sm:min-h-9"
          aria-label={
            advancedOpen
              ? t('usageLogsPage.filters.hideAdvanced')
              : t('usageLogsPage.filters.advanced')
          }
        >
          <span>
            {advancedOpen
              ? t('usageLogsPage.filters.hideAdvanced')
              : t('usageLogsPage.filters.advanced')}
          </span>
          {advancedOpen ? (
            <ChevronsUp className="text-primary size-5 stroke-[2.4]" aria-hidden="true" />
          ) : (
            <ChevronsDown className="text-primary size-5 stroke-[2.4]" aria-hidden="true" />
          )}
        </button>
      </CollapsibleTrigger>
    </Collapsible>
  )
}

function KpiCard({
  label,
  value,
  icon,
  sparkline,
  comparisonDelta,
  comparisonMode = 'increaseGood',
  tone = 'neutral',
}: {
  label: string
  value: string
  icon: ReactNode
  sparkline: number[]
  comparisonDelta: number | null
  comparisonMode?: KpiComparisonMode
  tone?: KpiTone
}) {
  return (
    <div className="bg-card flex h-full min-w-0 flex-col rounded-lg border p-3.5 shadow-sm">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="text-muted-foreground flex size-3.5 shrink-0 items-center justify-center">
          {icon}
        </span>
        <p className="text-muted-foreground min-w-0 truncate text-sm font-medium">{label}</p>
      </div>

      <div className="mt-auto flex items-end gap-4 pt-3">
        <div className="min-w-[88px] shrink-0">
          <p className="truncate text-2xl leading-none font-semibold tracking-normal tabular-nums">
            {value}
          </p>
          <KpiDelta delta={comparisonDelta} comparisonMode={comparisonMode} />
        </div>

        <KpiSparkline values={sparkline} tone={tone} className="h-16 flex-1" />
      </div>
    </div>
  )
}

function KpiDelta({
  delta,
  comparisonMode = 'increaseGood',
}: {
  delta: number | null
  comparisonMode?: KpiComparisonMode
}) {
  const tone = getKpiDeltaTone(delta, comparisonMode)
  const Icon = delta === null || Math.abs(delta) < 0.0001 ? Minus : delta > 0 ? ArrowUp : ArrowDown

  return (
    <p
      className={cn(
        'mt-2 inline-flex items-center gap-1 text-xs font-semibold',
        getKpiDeltaClassName(tone),
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="tabular-nums">{delta === null ? '—' : formatSignedDeltaPercent(delta)}</span>
    </p>
  )
}

function getKpiDeltaTone(
  delta: number | null,
  comparisonMode: KpiComparisonMode = 'increaseGood',
): KpiTone {
  if (delta === null || Math.abs(delta) < 0.0001) return 'neutral'
  const increased = delta > 0
  const isPositive = comparisonMode === 'increaseGood' ? increased : !increased
  return isPositive ? 'positive' : 'danger'
}

function getKpiDeltaClassName(tone: KpiTone) {
  return tone === 'positive'
    ? 'text-success'
    : tone === 'danger'
      ? 'text-destructive'
      : 'text-muted-foreground'
}

function formatDeltaPercent(value: number) {
  if (Math.abs(value) < 0.0001) return '0.0%'
  return formatPercent(Math.abs(value))
}

function formatSignedDeltaPercent(value: number) {
  if (Math.abs(value) < 0.0001) return '0.0%'
  return `${value > 0 ? '+' : '-'}${formatDeltaPercent(value)}`
}

function MetricDelta({
  delta,
  comparisonMode = 'increaseGood',
}: {
  delta: number | null | undefined
  comparisonMode?: KpiComparisonMode
}) {
  const { t } = useTranslation()
  if (delta === null || delta === undefined) return null

  const tone = getKpiDeltaTone(delta, comparisonMode)
  const Icon = Math.abs(delta) < 0.0001 ? Minus : delta > 0 ? ArrowUp : ArrowDown
  const value = formatSignedDeltaPercent(delta)

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 font-semibold tabular-nums',
        getKpiDeltaClassName(tone),
      )}
      title={t('usageLogsPage.credentials.deltaTooltip', { value })}
      aria-label={t('usageLogsPage.credentials.deltaLabel', { value })}
    >
      <Icon className="size-3" aria-hidden="true" />
      {value}
    </span>
  )
}

function KpiSparkline({
  values,
  tone,
  className,
}: {
  values: number[]
  tone: KpiTone
  className?: string
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const normalizedValues = values.map((value) => (Number.isFinite(value) ? value : 0))
  const width = 160
  const height = 64
  const padding = 4

  if (normalizedValues.length < 2) {
    return (
      <div
        className={cn(
          'flex h-16 min-w-0 items-center px-2',
          getKpiSparklineClassName(tone),
          className,
        )}
        aria-hidden="true"
      >
        <span className="h-px w-full bg-current/35" />
      </div>
    )
  }

  const min = Math.min(...normalizedValues)
  const max = Math.max(...normalizedValues)
  const span = max - min || 1
  const points = normalizedValues.map((value, index) => {
    const x = padding + (index / Math.max(1, normalizedValues.length - 1)) * (width - padding * 2)
    const y = height - padding - ((value - min) / span) * (height - padding * 2)
    return { x, y }
  })
  const pointList = points.map((point) => `${point.x},${point.y}`).join(' ')
  const activePoint = hoverIndex === null ? null : points[hoverIndex]
  const areaPath = [
    `M ${points[0]?.x ?? padding} ${height - padding}`,
    ...points.map((point) => `L ${point.x} ${point.y}`),
    `L ${points[points.length - 1]?.x ?? width - padding} ${height - padding}`,
    'Z',
  ].join(' ')

  return (
    <div
      className={cn(
        'relative h-16 min-w-0 overflow-visible',
        getKpiSparklineClassName(tone),
        className,
      )}
      aria-hidden="true"
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        const ratio = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0
        const clampedRatio = Math.min(1, Math.max(0, ratio))
        setHoverIndex(Math.round(clampedRatio * (points.length - 1)))
      }}
      onPointerLeave={() => setHoverIndex(null)}
    >
      <svg
        className="size-full"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        focusable="false"
      >
        <path d={areaPath} fill="currentColor" opacity="0.1" />
        <polyline
          points={pointList}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="5"
          opacity="0.12"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={pointList}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {activePoint ? (
        <span
          className="border-card pointer-events-none absolute size-2.5 rounded-full border-2 bg-current shadow-sm"
          style={{
            left: `${(activePoint.x / width) * 100}%`,
            top: `${(activePoint.y / height) * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ) : null}
    </div>
  )
}

function getKpiSparklineClassName(tone: KpiTone) {
  return tone === 'positive'
    ? 'text-success'
    : tone === 'warning'
      ? 'text-warning'
      : tone === 'danger'
        ? 'text-destructive'
        : tone === 'info'
          ? 'text-info'
          : 'text-primary'
}

function getDelta(previous: number, current: number) {
  if (Math.abs(previous) < 0.0001) return Math.abs(current) < 0.0001 ? 0 : null
  return (current - previous) / Math.abs(previous)
}

function compareTrendValues(values: number[], aggregate: 'sum' | 'average' = 'sum') {
  const finiteValues = values.filter((value) => Number.isFinite(value))
  if (finiteValues.length < 2) return null

  const midpoint = Math.floor(finiteValues.length / 2)
  const previousValues = finiteValues.slice(0, midpoint)
  const currentValues = finiteValues.slice(midpoint)
  if (previousValues.length === 0 || currentValues.length === 0) return null

  const aggregateValues = (items: number[]) => {
    const sum = items.reduce((total, value) => total + value, 0)
    return aggregate === 'average' ? sum / items.length : sum
  }

  return getDelta(aggregateValues(previousValues), aggregateValues(currentValues))
}

function getAmountSparkline(trend: UsageOverview['trend']) {
  return trend.map((bucket) => bucket.totalAmount ?? 0)
}

function getRequestSparkline(trend: UsageOverview['trend']) {
  return trend.map((bucket) => bucket.requestCount)
}

function getTokenSparkline(trend: UsageOverview['trend']) {
  return trend.map((bucket) => bucket.totalTokens)
}

function getKpiCardData(overview: UsageOverview, t: TFunction): KpiCardData[] {
  const trend = overview.trend
  const totals = overview.totals
  const requestSparkline = getRequestSparkline(trend)
  const tokenSparkline = getTokenSparkline(trend)
  const amountSparkline = getAmountSparkline(trend)

  return [
    {
      key: 'tokens',
      labelKey: 'usageLogsPage.kpi.tokens',
      value: formatCompactNumber(totals.totalTokens),
      icon: <CirclePile className="size-3.5" aria-hidden="true" />,
      sparkline: tokenSparkline,
      comparisonDelta: compareTrendValues(tokenSparkline),
      tone: 'neutral' as const,
    },
    {
      key: 'cost',
      labelKey: 'usageLogsPage.kpi.cost',
      value: formatKpiAmount(t, totals.totalAmount, totals.currency),
      icon: <CircleDollarSign className="size-3.5" aria-hidden="true" />,
      sparkline: amountSparkline,
      comparisonDelta: compareTrendValues(amountSparkline),
      tone: 'warning' as const,
    },
    {
      key: 'requests',
      labelKey: 'usageLogsPage.kpi.requests',
      value: formatCompactNumber(totals.requestCount),
      icon: <Send className="size-3.5" aria-hidden="true" />,
      sparkline: requestSparkline,
      comparisonDelta: compareTrendValues(requestSparkline),
      tone: 'info' as const,
    },
  ]
}

function getEmptyKpiCardData(): KpiCardData[] {
  return [
    {
      key: 'tokens',
      labelKey: 'usageLogsPage.kpi.tokens',
      value: '--',
      icon: <CirclePile className="size-3.5" aria-hidden="true" />,
      sparkline: [],
      comparisonDelta: null,
      tone: 'neutral',
    },
    {
      key: 'cost',
      labelKey: 'usageLogsPage.kpi.cost',
      value: '--',
      icon: <CircleDollarSign className="size-3.5" aria-hidden="true" />,
      sparkline: [],
      comparisonDelta: null,
      tone: 'neutral',
    },
    {
      key: 'requests',
      labelKey: 'usageLogsPage.kpi.requests',
      value: '--',
      icon: <Send className="size-3.5" aria-hidden="true" />,
      sparkline: [],
      comparisonDelta: null,
      tone: 'neutral',
    },
  ]
}

function SystemHealthCard({ overview }: { overview: UsageOverview }) {
  const { t } = useTranslation()
  const live = overview.live
  const errorRateAlert = live.errorRate > 0.05
  const p50Alert = live.p50LatencyMs > 1500
  const healthMetrics = [
    {
      key: 'rpm',
      label: t('usageLogsPage.kpi.healthMetrics.rpm'),
      value: formatRateNumber(live.rpm),
      tone: 'text-foreground',
      alert: false,
    },
    {
      key: 'tpm',
      label: t('usageLogsPage.kpi.healthMetrics.tpm'),
      value: formatCompactNumber(live.tpm),
      tone: 'text-foreground',
      alert: false,
    },
    {
      key: 'errorRate',
      label: t('usageLogsPage.kpi.healthMetrics.errorRate'),
      value: formatPercent(live.errorRate),
      tone: errorRateAlert ? 'text-destructive' : 'text-foreground',
      alert: errorRateAlert,
    },
    {
      key: 'p50Latency',
      label: t('usageLogsPage.kpi.healthMetrics.p50Latency'),
      value: formatDuration(live.p50LatencyMs) ?? '—',
      tone: p50Alert ? 'text-warning' : 'text-foreground',
      alert: p50Alert,
    },
  ]

  return (
    <div className="bg-card flex h-full min-w-0 flex-col rounded-lg border p-3.5 shadow-sm">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="text-muted-foreground flex size-3.5 shrink-0 items-center justify-center">
          <HeartPulse className="size-3.5" aria-hidden="true" />
        </span>
        <p className="text-muted-foreground min-w-0 truncate text-sm font-medium">
          {t('usageLogsPage.kpi.systemHealth')}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        {healthMetrics.map((metric) => (
          <div key={metric.key} className="min-w-0">
            <p className="text-muted-foreground truncate text-xs font-medium">{metric.label}</p>
            <p
              className={cn(
                'mt-1 flex items-center gap-1 text-base font-semibold tabular-nums',
                metric.tone,
              )}
            >
              {metric.alert ? (
                <AlertTriangle
                  className="size-3.5 shrink-0"
                  aria-label={t('usageLogsPage.kpi.healthMetrics.attention')}
                />
              ) : null}
              <span className="truncate">{metric.value}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function UsageKpiStrip({ overview }: { overview: UsageOverview | null }) {
  const { t } = useTranslation()
  const kpis = overview ? getKpiCardData(overview, t) : getEmptyKpiCardData()

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.key}
          label={t(kpi.labelKey)}
          value={kpi.value}
          icon={kpi.icon}
          sparkline={kpi.sparkline}
          comparisonDelta={kpi.comparisonDelta}
          comparisonMode={kpi.comparisonMode}
          tone={kpi.tone}
        />
      ))}
      {overview ? (
        <SystemHealthCard overview={overview} />
      ) : (
        <TableEmptyState
          compact
          kind="empty"
          className="bg-card m-0 h-full min-h-28 border-solid p-3.5 shadow-sm"
          title={t('usageLogsPage.kpi.emptyTitle')}
          description={t('usageLogsPage.kpi.emptyDescription')}
        />
      )}
    </div>
  )
}

type UsageTrendOverlayMetric = 'requests' | 'cost'
type TokenSeriesKey = 'inputTokens' | 'outputTokens' | 'cachedTokens' | 'reasoningTokens'
type TokenUsageChartDatum = {
  label: string
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  reasoningTokens: number
  overlayValue: number
  requestCount: number
  totalAmount: number | null
  failedCount: number
}

const tokenSeries: Array<{
  key: TokenSeriesKey
  labelKey: string
  color: string
}> = [
  {
    key: 'inputTokens',
    labelKey: 'usageLogsPage.trend.tokenSeries.input',
    color: 'var(--info)',
  },
  {
    key: 'outputTokens',
    labelKey: 'usageLogsPage.trend.tokenSeries.output',
    color: 'var(--success)',
  },
  {
    key: 'cachedTokens',
    labelKey: 'usageLogsPage.trend.tokenSeries.cache',
    color: 'var(--primary)',
  },
  {
    key: 'reasoningTokens',
    labelKey: 'usageLogsPage.trend.tokenSeries.reasoning',
    color: 'var(--warning)',
  },
]

function getOverlayValue(metric: UsageTrendOverlayMetric, bucket: UsageOverview['trend'][number]) {
  return metric === 'cost' ? (bucket.totalAmount ?? 0) : bucket.requestCount
}

function formatOverlayValue(
  metric: UsageTrendOverlayMetric,
  value: number,
  t: TFunction,
  currency?: string | null,
) {
  if (metric === 'cost') {
    return formatAmountUnit(t, value, currency) ?? '—'
  }

  return formatCompactNumber(value)
}

function TokenUsageChart({
  data,
  overlayMetric,
  visibleSeriesKeys,
  t,
  currency,
}: {
  data: TokenUsageChartDatum[]
  overlayMetric: UsageTrendOverlayMetric
  visibleSeriesKeys: TokenSeriesKey[]
  t: TFunction
  currency?: string | null
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(760)
  const [activeTarget, setActiveTarget] = useState<{
    index: number
    seriesKey?: TokenSeriesKey | 'overlay'
  } | null>(null)
  const width = chartWidth
  const height = 260
  const compact = width < 520
  const margin = {
    top: 10,
    right: compact ? 36 : 74,
    bottom: 42,
    left: compact ? 48 : 64,
  }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom
  const visibleTokenSeries = tokenSeries.filter((series) => visibleSeriesKeys.includes(series.key))
  const maxTokens = Math.max(
    ...data.map((item) => visibleTokenSeries.reduce((sum, series) => sum + item[series.key], 0)),
    1,
  )
  const maxOverlay = Math.max(...data.map((item) => item.overlayValue), 1)
  const overlayY = (value: number) => margin.top + innerHeight - (value / maxOverlay) * innerHeight
  const getX = (index: number) => margin.left + (index / Math.max(1, data.length - 1)) * innerWidth
  const bandWidth = innerWidth / Math.max(1, data.length)
  const barWidth = Math.min(38, Math.max(10, bandWidth * 0.58))
  const overlayPoints = data.map((item, index) => `${getX(index)},${overlayY(item.overlayValue)}`)
  const gridTicks = [0, 0.25, 0.5, 0.75, 1]
  const labelIndexes = [...new Set([0, Math.floor(data.length / 2), data.length - 1])].filter(
    (index) => index >= 0 && index < data.length,
  )
  const activeDatum = activeTarget ? data[activeTarget.index] : null
  const activeX = activeTarget ? getX(activeTarget.index) : null

  useEffect(() => {
    const element = chartRef.current
    if (!element) return

    const updateWidth = () => {
      const nextWidth = Math.max(320, Math.round(element.getBoundingClientRect().width))
      setChartWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth))
    }

    updateWidth()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth)
      return () => window.removeEventListener('resize', updateWidth)
    }

    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={chartRef}
      className="relative w-full min-w-0"
      onMouseLeave={() => setActiveTarget(null)}
    >
      <svg
        className="h-[260px] w-full overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t('usageLogsPage.trend.title')}
        preserveAspectRatio="xMidYMid meet"
      >
        {gridTicks.map((tick) => {
          const y = margin.top + innerHeight - tick * innerHeight
          const value = maxTokens * tick

          return (
            <g key={tick}>
              <line
                x1={margin.left}
                x2={margin.left + innerWidth}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="3 4"
              />
              <text
                x={margin.left - 10}
                y={y + 4}
                textAnchor="end"
                fill="var(--muted-foreground)"
                fontSize="11"
              >
                {formatCompactNumber(value)}
              </text>
              <text
                x={margin.left + innerWidth + 10}
                y={y + 4}
                fill="var(--muted-foreground)"
                fontSize="11"
              >
                {formatOverlayValue(overlayMetric, maxOverlay * tick, t, currency)}
              </text>
            </g>
          )
        })}

        {data.map((item, index) => {
          const x = margin.left + index * bandWidth + (bandWidth - barWidth) / 2
          let stackY = margin.top + innerHeight
          const values = visibleTokenSeries.map((series) => ({
            ...series,
            value: item[series.key],
          }))

          return (
            <g key={`${item.label}:${index}`}>
              <title>
                {[
                  item.label,
                  ...visibleTokenSeries.map(
                    (series) => `${t(series.labelKey)}: ${formatCompactNumber(item[series.key])}`,
                  ),
                  `${t(`usageLogsPage.trend.overlay.${overlayMetric}`)}: ${formatOverlayValue(
                    overlayMetric,
                    item.overlayValue,
                    t,
                    currency,
                  )}`,
                ].join('\n')}
              </title>
              {values.map((series, seriesIndex) => {
                const barHeight = (series.value / maxTokens) * innerHeight
                stackY -= barHeight
                const segmentIsActive =
                  activeTarget?.index === index && activeTarget.seriesKey === series.key
                const bucketIsActive = activeTarget?.index === index

                return (
                  <rect
                    key={series.key}
                    tabIndex={0}
                    aria-label={`${item.label} ${t(series.labelKey)} ${formatCompactNumber(
                      series.value,
                    )}`}
                    x={x}
                    y={stackY}
                    width={barWidth}
                    height={Math.max(0, barHeight)}
                    fill={series.color}
                    opacity={activeTarget ? (bucketIsActive ? 1 : 0.42) : 0.9}
                    rx={seriesIndex === values.length - 1 ? 3 : 0}
                    stroke={segmentIsActive ? 'var(--foreground)' : 'transparent'}
                    strokeWidth={segmentIsActive ? 1.5 : 0}
                    className="cursor-pointer transition-opacity"
                    vectorEffect="non-scaling-stroke"
                    onFocus={() => setActiveTarget({ index, seriesKey: series.key })}
                    onBlur={() => setActiveTarget(null)}
                    onMouseEnter={() => setActiveTarget({ index, seriesKey: series.key })}
                  />
                )
              })}
            </g>
          )
        })}

        {activeX !== null ? (
          <line
            x1={activeX}
            x2={activeX}
            y1={margin.top}
            y2={margin.top + innerHeight}
            stroke="var(--ring)"
            strokeDasharray="4 4"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {overlayPoints.length > 1 ? (
          <polyline
            points={overlayPoints.join(' ')}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {data.map((item, index) => (
          <circle
            key={`${item.label}:overlay`}
            tabIndex={0}
            aria-label={`${item.label} ${t(
              `usageLogsPage.trend.overlay.${overlayMetric}`,
            )} ${formatOverlayValue(overlayMetric, item.overlayValue, t, currency)}`}
            cx={getX(index)}
            cy={overlayY(item.overlayValue)}
            r={activeTarget?.index === index && activeTarget.seriesKey === 'overlay' ? 4.5 : 3}
            fill="var(--card)"
            stroke="var(--foreground)"
            strokeWidth={activeTarget?.index === index ? 2.4 : 2}
            className="cursor-pointer"
            vectorEffect="non-scaling-stroke"
            onFocus={() => setActiveTarget({ index, seriesKey: 'overlay' })}
            onBlur={() => setActiveTarget(null)}
            onMouseEnter={() => setActiveTarget({ index, seriesKey: 'overlay' })}
          />
        ))}
        {labelIndexes.map((index) => (
          <text
            key={index}
            x={getX(index)}
            y={height - 12}
            textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
            fill="var(--muted-foreground)"
            fontSize="11"
          >
            {data[index]?.label}
          </text>
        ))}
      </svg>
      {activeDatum ? (
        <div className="bg-popover text-popover-foreground pointer-events-none absolute top-2 right-2 max-w-[240px] rounded-md border px-3 py-2 text-xs shadow-sm">
          <p className="font-medium">{activeDatum.label}</p>
          <p className="text-muted-foreground mt-1">
            {t(`usageLogsPage.trend.overlay.${overlayMetric}`)}:{' '}
            {formatOverlayValue(overlayMetric, activeDatum.overlayValue, t, currency)}
          </p>
          <div className="mt-2 grid gap-1">
            {visibleTokenSeries.map((series) => (
              <div key={series.key} className="flex items-center justify-between gap-4">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: series.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{t(series.labelKey)}</span>
                </span>
                <span className="font-medium tabular-nums">
                  {formatCompactNumber(activeDatum[series.key])}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function UsageTrendPanel({ overview }: { overview: UsageOverview | null }) {
  const { t, i18n } = useTranslation()
  const [overlayMetric, setOverlayMetric] = useState<UsageTrendOverlayMetric>('requests')
  const [visibleSeriesKeys, setVisibleSeriesKeys] = useState<TokenSeriesKey[]>(
    tokenSeries.map((series) => series.key),
  )
  const chartData = useMemo(
    () =>
      overview?.trend.map((bucket) => ({
        label: formatShortDateTime(bucket.bucketStart, i18n),
        inputTokens: bucket.inputTokens,
        outputTokens: bucket.outputTokens,
        cachedTokens: bucket.cachedTokens,
        reasoningTokens: bucket.reasoningTokens,
        overlayValue: getOverlayValue(overlayMetric, bucket),
        requestCount: bucket.requestCount,
        totalAmount: bucket.totalAmount,
        failedCount: bucket.failedCount,
      })) ?? [],
    [i18n, overlayMetric, overview?.trend],
  )
  const toggleSeries = (seriesKey: TokenSeriesKey) => {
    setVisibleSeriesKeys((currentKeys) => {
      if (currentKeys.includes(seriesKey)) {
        return currentKeys.length === 1
          ? currentKeys
          : currentKeys.filter((key) => key !== seriesKey)
      }

      return [...currentKeys, seriesKey]
    })
  }

  return (
    <TableSurface className="flex min-w-0 flex-col p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <SectionHeader title={t('usageLogsPage.trend.title')} />
        <ToggleGroup
          type="single"
          value={overlayMetric}
          size="sm"
          className="border-0 bg-transparent p-0 shadow-none"
          onValueChange={(nextMetric) => {
            if (nextMetric) setOverlayMetric(nextMetric as UsageTrendOverlayMetric)
          }}
        >
          {(['requests', 'cost'] as UsageTrendOverlayMetric[]).map((metricKey) => (
            <ToggleGroupItem
              key={metricKey}
              value={metricKey}
              className="data-[state=on]:bg-muted data-[state=on]:text-foreground h-7 rounded-md px-2.5 text-xs data-[state=on]:shadow-none"
            >
              {t(`usageLogsPage.trend.overlay.${metricKey}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {tokenSeries.map((series) => (
          <button
            type="button"
            key={series.key}
            aria-pressed={visibleSeriesKeys.includes(series.key)}
            onClick={() => toggleSeries(series.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
              visibleSeriesKeys.includes(series.key)
                ? 'text-foreground bg-background hover:bg-muted/40'
                : 'text-muted-foreground bg-muted/40 hover:bg-muted/70',
            )}
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: series.color }}
              aria-hidden="true"
            />
            {t(series.labelKey)}
          </button>
        ))}
      </div>
      <div className="mt-3 min-w-0">
        {overview && chartData.length > 0 ? (
          <TokenUsageChart
            data={chartData}
            overlayMetric={overlayMetric}
            visibleSeriesKeys={visibleSeriesKeys}
            t={t}
            currency={overview.totals.currency}
          />
        ) : (
          <TableEmptyState
            kind="empty"
            className="m-0 min-h-[260px]"
            title={t('usageLogsPage.trend.emptyTitle')}
            description={t('usageLogsPage.trend.unavailable')}
          />
        )}
      </div>
    </TableSurface>
  )
}

const costBreakdownColors: Record<string, string> = {
  input: 'var(--info)',
  output: 'var(--success)',
  cache: 'var(--primary)',
  reasoning: 'var(--warning)',
  request: 'color-mix(in oklch, var(--foreground) 70%, var(--muted))',
  other: 'var(--muted-foreground)',
}

export function CostBreakdownPanel({ overview }: { overview: UsageOverview | null }) {
  const { t } = useTranslation()
  const items = overview?.costBreakdown ?? []
  const hasBreakdown = items.length > 0
  const totalAmount = overview?.totals.totalAmount ?? null
  const blendedCost = overview?.totals.blendedCostPer1mTokens ?? null

  return (
    <TableSurface className="min-w-0 p-4">
      <SectionHeader title={t('usageLogsPage.costBreakdown.title')} />
      <dl className="mt-4 grid grid-cols-2 gap-4 border-y py-3">
        <div className="min-w-0">
          <dt className="text-muted-foreground text-xs font-medium">
            {t('usageLogsPage.costBreakdown.totalCost')}
          </dt>
          <dd className="mt-1 truncate text-lg font-semibold tabular-nums">
            {formatKpiAmount(t, totalAmount, overview?.totals.currency)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground text-xs font-medium">
            {t('usageLogsPage.costBreakdown.blendedRate')}
          </dt>
          <dd className="mt-1 truncate text-lg font-semibold tabular-nums">
            {blendedCost === null
              ? '—'
              : t('usageLogsPage.costBreakdown.perMillion', {
                  value:
                    formatAmountUnit(t, blendedCost, overview?.totals.currency) ??
                    formatNumber(Math.round(blendedCost)),
                })}
          </dd>
        </div>
      </dl>

      {hasBreakdown ? (
        <>
          <div className="mt-4 flex h-7 overflow-hidden rounded-md border">
            {items.map((item) => (
              <div
                key={item.category}
                className="min-w-2"
                style={{
                  width: `${Math.max(2, (item.percentage ?? 0) * 100)}%`,
                  backgroundColor: costBreakdownColors[item.category] ?? costBreakdownColors.other,
                }}
                title={`${t(`usageLogsPage.costBreakdown.categories.${item.category}`)} ${formatPercent(
                  item.percentage ?? 0,
                )}`}
              />
            ))}
          </div>
          <div className="mt-4 grid gap-2.5">
            {items.map((item) => (
              <div
                key={item.category}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        costBreakdownColors[item.category] ?? costBreakdownColors.other,
                    }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm font-medium">
                    {t(`usageLogsPage.costBreakdown.categories.${item.category}`)}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {item.tokens === null
                      ? t('usageLogsPage.costBreakdown.itemBasis', {
                          basis: formatBillingBasis(item.billingBasis, t),
                        })
                      : t('usageLogsPage.costBreakdown.itemDetail', {
                          tokens: formatCompactNumber(item.tokens),
                          basis: formatBillingBasis(item.billingBasis, t),
                        })}
                  </span>
                </div>
                <div className="flex items-baseline justify-end gap-2 text-right">
                  <p className="text-sm leading-5 font-semibold tabular-nums">
                    {formatKpiAmount(t, item.amount, overview?.totals.currency)}
                  </p>
                  <p className="text-muted-foreground text-xs leading-5 tabular-nums">
                    {item.percentage === null ? '—' : formatPercent(item.percentage)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <TableEmptyState
          kind="empty"
          className="m-0 mt-4 min-h-36"
          title={t('usageLogsPage.costBreakdown.emptyTitle')}
          description={t('usageLogsPage.costBreakdown.unavailable')}
        />
      )}
    </TableSurface>
  )
}

export function RealtimeUsagePanel({ realtime }: { realtime: UsageRealtimeSnapshot | null }) {
  const { t, i18n } = useTranslation()

  if (!realtime) return null

  const maxLatencyRequests = Math.max(
    1,
    ...realtime.latencyDistribution.map((bucket) => bucket.requestCount),
  )
  const latestBucket = realtime.velocity.at(-1) ?? null
  const totalWindowRequests = realtime.velocity.reduce((sum, bucket) => sum + bucket.rpm, 0)
  const weightedErrorRate =
    totalWindowRequests > 0
      ? realtime.velocity.reduce((sum, bucket) => sum + bucket.errorRate * bucket.rpm, 0) /
        totalWindowRequests
      : 0

  return (
    <TableSurface className="min-w-0 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeader title={t('usageLogsPage.realtime.title')} />
        <p className="text-muted-foreground text-sm">
          {t('usageLogsPage.realtime.updatedAt', {
            time: formatDateTime(realtime.updatedAt, i18n) ?? realtime.updatedAt,
          })}
        </p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(260px,0.78fr)_minmax(360px,1.22fr)]">
        <div className="grid min-w-0 gap-3 md:grid-cols-3 xl:grid-cols-1">
          <div className="rounded-md border px-3 py-2.5">
            <p className="text-muted-foreground text-xs font-medium">
              {t('usageLogsPage.realtime.metrics.rpm')}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatRateNumber(latestBucket?.rpm ?? 0)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('usageLogsPage.realtime.window', {
                window:
                  formatDuration(realtime.windowSeconds * 1000) ?? `${realtime.windowSeconds}s`,
              })}
            </p>
          </div>
          <div className="rounded-md border px-3 py-2.5">
            <p className="text-muted-foreground text-xs font-medium">
              {t('usageLogsPage.realtime.metrics.tpm')}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatCompactNumber(latestBucket?.tpm ?? 0)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('usageLogsPage.realtime.bucket', {
                bucket:
                  formatDuration(realtime.bucketSeconds * 1000) ?? `${realtime.bucketSeconds}s`,
              })}
            </p>
          </div>
          <div className="rounded-md border px-3 py-2.5">
            <p className="text-muted-foreground text-xs font-medium">
              {t('usageLogsPage.realtime.metrics.errorRate')}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatPercent(weightedErrorRate)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('usageLogsPage.realtime.groupBy', {
                group: t(`usageLogsPage.rankings.groups.${realtime.groupBy}`),
              })}
            </p>
          </div>
        </div>

        <div className="min-w-0 rounded-md border p-3">
          <h3 className="text-sm font-semibold">
            {t('usageLogsPage.realtime.latencyDistribution')}
          </h3>
          <div className="mt-3 grid gap-2">
            {realtime.latencyDistribution.length > 0 ? (
              realtime.latencyDistribution.map((bucket) => (
                <div key={bucket.bucket} className="grid gap-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{bucket.bucket}</span>
                    <span className="font-medium">{formatNumber(bucket.requestCount)}</span>
                  </div>
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-info h-full rounded-full"
                      style={{
                        width: `${Math.max(2, (bucket.requestCount / maxLatencyRequests) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <TableEmptyState
                kind="empty"
                className="m-0 min-h-32"
                title={t('usageLogsPage.realtime.emptyTitle')}
                description={t('usageLogsPage.realtime.empty')}
              />
            )}
          </div>
        </div>
      </div>
    </TableSurface>
  )
}

const rankingGroupOptions: UsageAggregateGroupBy[] = [
  'user',
  'model',
  'client_key',
  'credential',
  'provider',
  'endpoint',
  'home_ip',
  'executor_type',
]

const rankingMetricOptions: UsageAggregateMetric[] = [
  'request_count',
  'total_tokens',
  'total_amount',
  'failed_count',
  'avg_latency_ms',
  'p95_latency_ms',
]

type RankingColumnKey =
  | 'rank'
  | 'name'
  | 'amount'
  | 'requests'
  | 'avgRequestCost'
  | 'costPerMillionTokens'
  | 'successRate'
  | 'cacheRate'
  | 'tokens'
  | 'avgLatency'

const rankingColumns: Array<{
  key: RankingColumnKey
  width: number
  align?: 'right'
  required?: boolean
}> = [
  { key: 'rank', width: 64, required: true },
  { key: 'name', width: 240, required: true },
  { key: 'amount', width: 124, align: 'right' },
  { key: 'requests', width: 112, align: 'right' },
  { key: 'avgRequestCost', width: 148, align: 'right' },
  { key: 'costPerMillionTokens', width: 168, align: 'right' },
  { key: 'successRate', width: 124, align: 'right' },
  { key: 'cacheRate', width: 124, align: 'right' },
  { key: 'tokens', width: 132, align: 'right' },
  { key: 'avgLatency', width: 124, align: 'right' },
]

const defaultRankingColumns = rankingColumns.map((column) => column.key)

// Rank order is already carried by the leading number, so the bullet is decorative:
// use a single brand ramp (opacity steps of --primary) instead of raw palette hues,
// keeping one color language and tracking theme/dark-mode token shifts.
const rankingBulletClassNames = [
  'bg-primary ring-primary/10',
  'bg-primary/80 ring-primary/10',
  'bg-primary/65 ring-primary/10',
  'bg-primary/50 ring-primary/10',
  'bg-primary/40 ring-primary/10',
]

function getMetadataString(item: UsageAggregateItem, keys: string[]) {
  for (const key of keys) {
    const value = item.metadata[key]
    if (typeof value === 'string' && value.trim()) return value
  }

  return null
}

function normalizeProviderLogoId(value: string | null) {
  if (!value) return null
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_.]+/g, '-')
  if (!normalized) return null
  if (normalized.includes('codex')) return 'codex'
  if (normalized.includes('claude') || normalized.includes('anthropic')) return 'claude'
  if (normalized.includes('gemini') || normalized.includes('google')) return 'gemini'
  if (normalized.includes('vertex')) return 'vertex'
  if (normalized.includes('kimi') || normalized.includes('moonshot')) return 'kimi'
  if (normalized.includes('xai') || normalized.includes('x-ai') || normalized.includes('grok')) {
    return 'xai'
  }
  if (
    normalized.includes('openai') ||
    normalized.includes('chatgpt') ||
    /^gpt[-\w]*/.test(normalized) ||
    /^o\d[-\w]*/.test(normalized)
  ) {
    return 'openaiCompatibility'
  }

  return normalized
}

function getRankingProviderLogoId(item: UsageAggregateItem, groupBy: UsageAggregateGroupBy) {
  const provider =
    getMetadataString(item, ['provider', 'provider_id', 'providerId']) ??
    (groupBy === 'provider' ? item.id || item.label : null)
  const fallback = groupBy === 'model' || groupBy === 'provider' ? item.label : null

  return normalizeProviderLogoId(provider) ?? normalizeProviderLogoId(fallback)
}

function RankingIdentityMarker({
  item,
  groupBy,
  index,
}: {
  item: UsageAggregateItem
  groupBy: UsageAggregateGroupBy
  index: number
}) {
  const providerLogoId = getRankingProviderLogoId(item, groupBy)
  if (
    providerLogoId &&
    (groupBy === 'model' || groupBy === 'provider' || groupBy === 'credential')
  ) {
    return <ProviderLogo providerId={providerLogoId} size="sm" className="rounded" />
  }

  if (groupBy === 'user') {
    return <RankingBullet index={index} />
  }

  if (groupBy === 'client_key') {
    return <RankingBullet index={index} />
  }

  return (
    <span
      className="border-border bg-muted text-muted-foreground flex size-5 items-center justify-center rounded-md border"
      aria-hidden="true"
    >
      <Hash className="size-3" />
    </span>
  )
}

function RankingBullet({ index }: { index: number }) {
  return (
    <span
      className={cn(
        'size-2 rounded-full ring-4',
        rankingBulletClassNames[index % rankingBulletClassNames.length],
      )}
      aria-hidden="true"
    />
  )
}

function getTopSpendItems(items: UsageAggregateItem[]) {
  return [...items].sort((left, right) => {
    const amountDelta = (right.totalAmount ?? -1) - (left.totalAmount ?? -1)
    if (amountDelta !== 0) return amountDelta
    if (right.requestCount !== left.requestCount) return right.requestCount - left.requestCount
    return right.totalTokens - left.totalTokens
  })
}

function getAverageRequestCost(item: UsageAggregateItem) {
  if (item.totalAmount === null || item.requestCount <= 0) return null
  return item.totalAmount / item.requestCount
}

function getCostPerMillionTokens(item: UsageAggregateItem) {
  if (item.totalAmount === null || item.totalTokens <= 0) return null
  return (item.totalAmount / item.totalTokens) * 1_000_000
}

function formatRankingColumnValue(
  item: UsageAggregateItem,
  column: RankingColumnKey,
  t: TFunction,
) {
  if (column === 'amount') return formatKpiAmount(t, item.totalAmount, item.currency)
  if (column === 'requests') return formatNumber(item.requestCount)
  if (column === 'avgRequestCost')
    return formatAmountUnit(t, getAverageRequestCost(item), item.currency) ?? '—'
  if (column === 'costPerMillionTokens')
    return formatAmountUnit(t, getCostPerMillionTokens(item), item.currency) ?? '—'
  if (column === 'successRate') return formatPercent(item.successRate)
  if (column === 'cacheRate') return item.cacheRate === null ? '—' : formatPercent(item.cacheRate)
  if (column === 'tokens') return formatNumber(item.totalTokens)
  if (column === 'avgLatency') return formatDuration(item.avgLatencyMs) ?? '—'

  return '—'
}

export function RankingGrid({
  overview,
  aggregate,
  selectedGroup,
  selectedMetric,
  detailOpen,
  expanded,
  pending,
  errorMessage,
  onGroupChange,
  onMetricChange,
  onDetailOpenChange,
  onExpandedChange,
}: {
  overview: UsageOverview | null
  aggregate: UsageAggregateResponse | null
  selectedGroup: UsageAggregateGroupBy
  selectedMetric: UsageAggregateMetric
  detailOpen: boolean
  expanded: boolean
  pending: boolean
  errorMessage: string | null
  onGroupChange: (group: UsageAggregateGroupBy) => void
  onMetricChange: (metric: UsageAggregateMetric) => void
  onDetailOpenChange: (open: boolean) => void
  onExpandedChange: (expanded: boolean) => void
}) {
  const { t } = useTranslation()
  const [visibleRankingColumns, setVisibleRankingColumns] =
    useState<RankingColumnKey[]>(defaultRankingColumns)
  if (!overview && !aggregate) return null
  const selectedGroupLabel = t(`usageLogsPage.rankings.groups.${selectedGroup}`)
  const isRankingColumnVisible = (column: RankingColumnKey) =>
    visibleRankingColumns.includes(column)
  const visibleRankingColumnConfigs = rankingColumns.filter((column) =>
    isRankingColumnVisible(column.key),
  )
  const visibleRankingTableWidth = visibleRankingColumnConfigs.reduce(
    (width, column) => width + column.width,
    0,
  )
  const selectableRankingMetricOptions = aggregate
    ? rankingMetricOptions.filter((metric) => aggregate.sortableMetrics.includes(metric))
    : rankingMetricOptions
  const toggleRankingColumn = (column: RankingColumnKey, checked: boolean) => {
    const config = rankingColumns.find((item) => item.key === column)
    if (config?.required && !checked) return

    setVisibleRankingColumns((currentColumns) => {
      if (checked) {
        return currentColumns.includes(column) ? currentColumns : [...currentColumns, column]
      }

      return currentColumns.filter((item) => item !== column)
    })
  }

  const groups: Array<{
    id: keyof UsageOverview['top']
    groupBy: UsageAggregateGroupBy
    title: string
    items: UsageAggregateItem[]
  }> = [
    {
      id: 'users',
      groupBy: 'user',
      title: t('usageLogsPage.rankings.users'),
      items: overview?.top.users ?? [],
    },
    {
      id: 'models',
      groupBy: 'model',
      title: t('usageLogsPage.rankings.models'),
      items: overview?.top.models ?? [],
    },
    {
      id: 'clientKeys',
      groupBy: 'client_key',
      title: t('usageLogsPage.rankings.clientKeys'),
      items: overview?.top.clientKeys ?? [],
    },
  ]

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-3">
        {groups.map((group) => {
          const selected = detailOpen && selectedGroup === group.groupBy

          return (
            <TableSurface
              key={group.id}
              className={cn(
                'min-w-0 p-3.5 transition-colors',
                selected && 'border-primary/35 bg-primary/5',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="truncate text-sm font-semibold">{group.title}</h3>
                <Button
                  type="button"
                  variant={selected ? 'secondary' : 'outline'}
                  size="xs"
                  aria-pressed={selected}
                  aria-label={
                    selected
                      ? t('usageLogsPage.rankings.hideDetail')
                      : t('usageLogsPage.rankings.viewDetailLabel')
                  }
                  className={cn(
                    'shrink-0 shadow-none',
                    selected && 'bg-muted text-foreground hover:bg-muted',
                  )}
                  onClick={() => {
                    if (selected) {
                      onDetailOpenChange(false)
                      return
                    }

                    onMetricChange('total_amount')
                    onGroupChange(group.groupBy)
                  }}
                >
                  <List className="size-3" aria-hidden="true" />
                  {selected
                    ? t('usageLogsPage.rankings.hideDetail')
                    : t('usageLogsPage.rankings.viewDetail')}
                </Button>
              </div>
              <div className="mt-3 grid gap-2">
                {group.items.length > 0 ? (
                  getTopSpendItems(group.items)
                    .slice(0, 3)
                    .map((item, index) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2"
                      >
                        <span className="text-muted-foreground font-mono text-xs">
                          {String(index + 1)}
                        </span>
                        <div className="flex min-w-0 items-center gap-2">
                          <RankingIdentityMarker
                            item={item}
                            groupBy={group.groupBy}
                            index={index}
                          />
                          <p className="truncate text-sm font-medium">{item.label}</p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatKpiAmount(t, item.totalAmount, item.currency)}
                        </span>
                      </div>
                    ))
                ) : (
                  <p className="text-muted-foreground py-4 text-sm">
                    {t('usageLogsPage.rankings.empty')}
                  </p>
                )}
              </div>
            </TableSurface>
          )
        })}
      </div>

      <Sheet open={detailOpen} onOpenChange={onDetailOpenChange}>
        <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <SheetHeader className="border-b p-5">
            <SheetTitle>
              {t('usageLogsPage.rankings.drawerTitle', { group: selectedGroupLabel })}
            </SheetTitle>
            <SheetDescription>{t('usageLogsPage.rankings.drawerDescription')}</SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="grid gap-2 border-b p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
              <Select
                value={selectedGroup}
                onValueChange={(group) => onGroupChange(group as UsageAggregateGroupBy)}
              >
                <SelectTrigger size="sm" aria-label={t('usageLogsPage.rankings.groupBy')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rankingGroupOptions.map((group) => (
                    <SelectItem key={group} value={group}>
                      {t(`usageLogsPage.rankings.groups.${group}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedMetric}
                disabled={selectableRankingMetricOptions.length === 0}
                onValueChange={(metric) => onMetricChange(metric as UsageAggregateMetric)}
              >
                <SelectTrigger size="sm" aria-label={t('usageLogsPage.rankings.metric')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectableRankingMetricOptions.map((metric) => (
                    <SelectItem key={metric} value={metric}>
                      {t(`usageLogsPage.rankings.metrics.${metric}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onExpandedChange(!expanded)}
              >
                {expanded
                  ? t('usageLogsPage.rankings.showTop10')
                  : t('usageLogsPage.rankings.showTop50')}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Columns3 className="size-4" aria-hidden="true" />
                    {t('actions.customizeColumns')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{t('usageLogsPage.rankings.columnsMenu')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {rankingColumns.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.key}
                      checked={isRankingColumnVisible(column.key)}
                      disabled={column.required}
                      onSelect={(event) => event.preventDefault()}
                      onCheckedChange={(checked) =>
                        toggleRankingColumn(column.key, Boolean(checked))
                      }
                    >
                      {t(`usageLogsPage.rankings.columns.${column.key}`)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {errorMessage ? (
              <p className="border-destructive/20 bg-destructive/10 text-destructive mx-4 mt-4 rounded-md border px-3 py-2 text-sm">
                {errorMessage}
              </p>
            ) : null}

            <div className="min-h-0 overflow-hidden p-4">
              {pending ? (
                <div className="grid gap-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 rounded-md" />
                  ))}
                </div>
              ) : aggregate && aggregate.items.length > 0 ? (
                <Table
                  containerClassName="max-h-[min(640px,calc(100vh-260px))] overflow-auto rounded-md border"
                  className="table-fixed"
                  style={{ minWidth: visibleRankingTableWidth }}
                >
                  <TableHeader className={stickyTableHeaderClassName}>
                    <TableRow variant="static">
                      {visibleRankingColumnConfigs.map((column) => (
                        <TableHead
                          key={column.key}
                          className={cn(column.align === 'right' && 'text-right')}
                          style={{ width: column.width }}
                        >
                          {t(`usageLogsPage.rankings.columns.${column.key}`)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aggregate.items.map((item, index) => (
                      <TableRow key={item.id} variant="resource">
                        {visibleRankingColumnConfigs.map((column) => {
                          if (column.key === 'rank') {
                            return (
                              <TableCell
                                key={column.key}
                                className="text-muted-foreground font-mono text-xs"
                              >
                                {String(aggregate.offset + index + 1)}
                              </TableCell>
                            )
                          }

                          if (column.key === 'name') {
                            return (
                              <TableCell key={column.key}>
                                <div className="flex min-w-0 items-center gap-2">
                                  <RankingIdentityMarker
                                    item={item}
                                    groupBy={selectedGroup}
                                    index={aggregate.offset + index}
                                  />
                                  <span className="truncate font-medium">{item.label}</span>
                                </div>
                              </TableCell>
                            )
                          }

                          return (
                            <TableCell
                              key={column.key}
                              className={cn(
                                'tabular-nums',
                                column.align === 'right' && 'text-right',
                              )}
                            >
                              {formatRankingColumnValue(item, column.key, t)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground rounded-md border px-3 py-8 text-sm">
                  {t('usageLogsPage.rankings.empty')}
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function StatusBadge({ record }: { record: UsageRecord }) {
  const { t } = useTranslation()

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
        record.failed
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-success/30 bg-success/10 text-success',
      )}
    >
      {record.failed ? t('usageLogsPage.status.failed') : t('usageLogsPage.status.success')}
      {record.statusCode ? <span className="ml-1 font-mono">{record.statusCode}</span> : null}
    </span>
  )
}

function CredentialBadge({ credential }: { credential: UsageExecutionCredential | null }) {
  const { t } = useTranslation()
  if (!credential) return <span>{t('usageLogsPage.status.notAvailable')}</span>

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium">
      <ShieldCheck className="text-muted-foreground size-3" aria-hidden="true" />
      {t(`usageLogsPage.credentialTypes.${credential.credentialType}`)}
    </span>
  )
}

function getUsageProviderLogoId(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const logoId = normalizeProviderLogoId(value ?? null)
    if (logoId) return logoId
  }

  return null
}

function UsageProviderLogo({
  values,
  className,
}: {
  values: Array<string | null | undefined>
  className?: string
}) {
  const logoId = getUsageProviderLogoId(...values)

  if (logoId) {
    return <ProviderLogo providerId={logoId} size="sm" className={cn('rounded', className)} />
  }

  return (
    <span
      className={cn(
        'border-border bg-muted text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded-md border',
        className,
      )}
      aria-hidden="true"
    >
      <Hash className="size-3" />
    </span>
  )
}

function RequestModelCell({ record }: { record: UsageRecord }) {
  const { t } = useTranslation()

  return (
    <div className="flex min-w-0 items-start gap-2">
      <UsageProviderLogo values={[record.provider, record.model]} className="mt-0.5" />
      <div className="min-w-0">
        <p className="truncate font-medium">
          {record.model ?? t('usageLogsPage.status.notAvailable')}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {record.provider ?? t('usageLogsPage.status.notAvailable')} ·{' '}
          {record.endpoint ?? t('usageLogsPage.status.notAvailable')}
        </p>
      </div>
    </div>
  )
}

function UsageCallerCell({ client }: { client: UsageRecord['client'] }) {
  const { t } = useTranslation()
  const clientKey = client?.apiKeyLabel ?? client?.apiKeyMasked
  const primary =
    client?.username ?? clientKey ?? client?.clientIp ?? t('usageLogsPage.caller.notRecorded')
  const secondary = client?.username
    ? (clientKey ?? client?.clientIp)
    : clientKey
      ? client?.clientIp
      : null
  const primaryIsTechnical = !client?.username && Boolean(clientKey ?? client?.clientIp)

  return (
    <div className="min-w-0">
      <p className={cn('truncate font-medium', primaryIsTechnical ? 'font-mono text-sm' : null)}>
        {primary}
      </p>
      {secondary ? (
        <p className="text-muted-foreground truncate font-mono text-xs">{secondary}</p>
      ) : null}
    </div>
  )
}

function ProviderValueCell({ provider, fallback }: { provider: string | null; fallback: string }) {
  const label = provider ?? fallback

  return (
    <div className="flex min-w-0 items-center gap-2">
      <UsageProviderLogo values={[provider]} />
      <span className="truncate">{label}</span>
    </div>
  )
}

type UsageRecordColumnKey =
  | 'time'
  | 'status'
  | 'model'
  | 'client'
  | 'credential'
  | 'tokens'
  | 'performance'
  | 'cost'
  | 'request'

const usageRecordColumns: Array<{
  key: UsageRecordColumnKey
  width: number
  align?: 'right'
  required?: boolean
}> = [
  { key: 'time', width: 156, required: true },
  { key: 'status', width: 116, required: true },
  { key: 'model', width: 230, required: true },
  { key: 'client', width: 210 },
  { key: 'credential', width: 230 },
  { key: 'tokens', width: 170, align: 'right' },
  { key: 'performance', width: 150, align: 'right' },
  { key: 'cost', width: 100, align: 'right' },
  { key: 'request', width: 210 },
]

const defaultUsageRecordColumns = usageRecordColumns.map((column) => column.key)
const usageRecordActionColumnWidth = 116
const requestRecordFilterGridClassName = 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
const usageRecordColumnSortableFields: Partial<
  Record<UsageRecordColumnKey, UsageRecordSortableField>
> = {
  time: 'timestamp',
  tokens: 'total_tokens',
  performance: 'latency_ms',
  cost: 'total_amount',
}

type UsageRecordSortConfig = {
  nextSort: UsageFilters['sort']
  direction: 'ascending' | 'descending' | null
}

function getNextUsageRecordSort(
  currentSort: UsageFilters['sort'],
  descendingSort: UsageFilters['sort'],
  ascendingSort: UsageFilters['sort'],
) {
  if (currentSort === descendingSort) return ascendingSort
  if (currentSort === ascendingSort) return null
  return descendingSort
}

function getUsageRecordSortDirection(
  currentSort: UsageFilters['sort'],
  descendingSort: UsageFilters['sort'],
  ascendingSort: UsageFilters['sort'],
): UsageRecordSortConfig['direction'] {
  if (currentSort === descendingSort) return 'descending'
  if (currentSort === ascendingSort) return 'ascending'
  return null
}

function buildUsageRecordSortConfig(
  currentSort: UsageFilters['sort'],
  descendingSort: UsageFilters['sort'],
  ascendingSort: UsageFilters['sort'],
): UsageRecordSortConfig {
  return {
    direction: getUsageRecordSortDirection(currentSort, descendingSort, ascendingSort),
    nextSort: getNextUsageRecordSort(currentSort, descendingSort, ascendingSort),
  }
}

function getUsageRecordSortConfig(
  column: UsageRecordColumnKey,
  currentSort: UsageFilters['sort'],
  sortableFields: UsageRecordSortableField[],
): UsageRecordSortConfig | null {
  const sortableField = usageRecordColumnSortableFields[column]
  if (!sortableField || !sortableFields.includes(sortableField)) return null

  if (column === 'time') {
    return buildUsageRecordSortConfig(currentSort, 'timestamp_desc', 'timestamp_asc')
  }

  if (column === 'tokens') {
    return buildUsageRecordSortConfig(currentSort, 'tokens_desc', 'tokens_asc')
  }

  if (column === 'performance') {
    return buildUsageRecordSortConfig(currentSort, 'latency_desc', 'latency_asc')
  }

  if (column === 'cost') {
    return buildUsageRecordSortConfig(currentSort, 'cost_desc', 'cost_asc')
  }

  return null
}

function UsageRecordTableHead({
  column,
  sort,
  sortableFields,
  disabled,
  onSortChange,
}: {
  column: (typeof usageRecordColumns)[number]
  sort: UsageFilters['sort']
  sortableFields: UsageRecordSortableField[]
  disabled: boolean
  onSortChange: (sort: UsageFilters['sort']) => void
}) {
  const { t } = useTranslation()
  const sortConfig = getUsageRecordSortConfig(column.key, sort, sortableFields)
  const label = t(`usageLogsPage.records.columns.${column.key}`)

  if (!sortConfig) {
    return (
      <TableHead
        className={cn(column.align === 'right' && 'text-right')}
        style={{ width: column.width }}
      >
        {label}
      </TableHead>
    )
  }

  const Icon = sortConfig.direction
    ? sortConfig.direction === 'ascending'
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown
  const sortLabel = sortConfig.nextSort
    ? t(`usageLogsPage.filters.sorts.${sortConfig.nextSort}`)
    : null

  return (
    <TableHead
      aria-sort={sortConfig.direction ?? 'none'}
      className={cn(column.align === 'right' && 'text-right')}
      style={{ width: column.width }}
    >
      <button
        type="button"
        className={cn(
          'hover:bg-background/80 focus-visible:ring-ring -mx-2 inline-flex h-8 max-w-full items-center gap-1.5 rounded-md px-2 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
          column.align === 'right' && 'ml-auto justify-end text-right',
          sortConfig.direction && 'text-foreground',
        )}
        disabled={disabled}
        onClick={() => onSortChange(sortConfig.nextSort)}
        aria-label={
          sortLabel
            ? t('usageLogsPage.records.sortColumn', {
                column: label,
                sort: sortLabel,
              })
            : t('usageLogsPage.records.clearSortColumn', { column: label })
        }
        title={sortLabel ?? t('usageLogsPage.records.clearSortColumn', { column: label })}
      >
        <span className="truncate">{label}</span>
        <Icon
          className={cn(
            'size-3 shrink-0 stroke-[2.5]',
            sortConfig.direction ? 'text-foreground' : 'text-muted-foreground',
          )}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  )
}

function RequestRecordFiltersToolbar({
  filters,
  options,
  disabled,
  onChange,
}: {
  filters: UsageFilters
  options: UsageFilterOptions
  disabled: boolean
  onChange: (nextFilters: Partial<UsageFilters>) => void
}) {
  const { t } = useTranslation()

  const isRangeInvalid = (min: string, max: string) => {
    const minText = String(min ?? '').trim()
    const maxText = String(max ?? '').trim()
    if (!minText || !maxText) return false
    const minValue = Number(minText)
    const maxValue = Number(maxText)
    return Number.isFinite(minValue) && Number.isFinite(maxValue) && minValue > maxValue
  }
  const latencyRangeInvalid = isRangeInvalid(filters.minLatencyMs, filters.maxLatencyMs)
  const amountRangeInvalid = isRangeInvalid(filters.minAmount, filters.maxAmount)

  return (
    <div className={requestRecordFilterGridClassName}>
      <div className="relative min-w-0">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          className={cn(usageTouchInputClassName, 'pl-9')}
          value={filters.search}
          disabled={disabled}
          placeholder={t('usageLogsPage.filters.searchPlaceholder')}
          onChange={(event) => onChange({ search: event.target.value })}
        />
      </div>
      <Select
        value={filters.status}
        disabled={disabled}
        onValueChange={(status) => onChange({ status: status as UsageFilters['status'] })}
      >
        <SelectTrigger
          className={usageTouchControlClassName}
          size="sm"
          aria-label={t('usageLogsPage.filters.status')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('usageLogsPage.filters.statuses.all')}</SelectItem>
          <SelectItem value="success">{t('usageLogsPage.filters.statuses.success')}</SelectItem>
          <SelectItem value="failed">{t('usageLogsPage.filters.statuses.failed')}</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={filters.statusCode}
        disabled={disabled}
        onValueChange={(statusCode) => onChange({ statusCode })}
      >
        <SelectTrigger
          className={usageTouchControlClassName}
          size="sm"
          aria-label={t('usageLogsPage.filters.statusCode')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('usageLogsPage.filters.anyStatusCode')}</SelectItem>
          {options.statusCodes.map((statusCode) => (
            <SelectItem key={statusCode} value={statusCode}>
              {statusCode}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="min-w-0">
        <div className="grid grid-cols-2 gap-2">
          <Input
            className={usageTouchInputClassName}
            type="number"
            inputMode="numeric"
            min={0}
            value={filters.minLatencyMs}
            disabled={disabled}
            aria-invalid={latencyRangeInvalid || undefined}
            placeholder={t('usageLogsPage.filters.minLatencyPlaceholder')}
            aria-label={t('usageLogsPage.filters.minLatencyMs')}
            onChange={(event) => onChange({ minLatencyMs: event.target.value })}
          />
          <Input
            className={usageTouchInputClassName}
            type="number"
            inputMode="numeric"
            min={0}
            value={filters.maxLatencyMs}
            disabled={disabled}
            aria-invalid={latencyRangeInvalid || undefined}
            placeholder={t('usageLogsPage.filters.maxLatencyPlaceholder')}
            aria-label={t('usageLogsPage.filters.maxLatencyMs')}
            onChange={(event) => onChange({ maxLatencyMs: event.target.value })}
          />
        </div>
        {latencyRangeInvalid ? (
          <p className="text-destructive mt-1 text-xs">{t('usageLogsPage.filters.rangeInvalid')}</p>
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="grid grid-cols-2 gap-2">
          <Input
            className={usageTouchInputClassName}
            type="number"
            inputMode="decimal"
            min={0}
            value={filters.minAmount}
            disabled={disabled}
            aria-invalid={amountRangeInvalid || undefined}
            placeholder={t('usageLogsPage.filters.minAmountPlaceholder')}
            aria-label={t('usageLogsPage.filters.minAmount')}
            onChange={(event) => onChange({ minAmount: event.target.value })}
          />
          <Input
            className={usageTouchInputClassName}
            type="number"
            inputMode="decimal"
            min={0}
            value={filters.maxAmount}
            disabled={disabled}
            aria-invalid={amountRangeInvalid || undefined}
            placeholder={t('usageLogsPage.filters.maxAmountPlaceholder')}
            aria-label={t('usageLogsPage.filters.maxAmount')}
            onChange={(event) => onChange({ maxAmount: event.target.value })}
          />
        </div>
        {amountRangeInvalid ? (
          <p className="text-destructive mt-1 text-xs">{t('usageLogsPage.filters.rangeInvalid')}</p>
        ) : null}
      </div>
    </div>
  )
}

export function RequestRecordsTable({
  records,
  filters,
  filterOptions,
  pageSizeOptions,
  fetching,
  mutating,
  canExport,
  isExporting,
  unavailable,
  errorMessage,
  onInspect,
  onFilterChange,
  onLimitChange,
  onOffsetChange,
  onExport,
}: {
  records: UsageRecordsPage | null
  filters: UsageFilters
  filterOptions: UsageFilterOptions
  pageSizeOptions: number[]
  fetching: boolean
  mutating: boolean
  canExport: boolean
  isExporting: boolean
  unavailable: boolean
  errorMessage: string | null
  onInspect: (record: UsageRecord) => void
  onFilterChange: (nextFilters: Partial<UsageFilters>) => void
  onLimitChange: (limit: number) => void
  onOffsetChange: (offset: number) => void
  onExport: () => void
}) {
  const { t, i18n } = useTranslation()
  const [visibleColumns, setVisibleColumns] =
    useState<UsageRecordColumnKey[]>(defaultUsageRecordColumns)
  const rows = records?.items ?? []
  const total = records?.total ?? 0
  const start = total > 0 ? filters.offset + 1 : 0
  const end = Math.min(filters.offset + rows.length, total)
  const canGoPrevious = filters.offset > 0
  const canGoNext = filters.offset + filters.limit < total
  const isColumnVisible = (column: UsageRecordColumnKey) => visibleColumns.includes(column)
  const visibleColumnConfigs = usageRecordColumns.filter((column) => isColumnVisible(column.key))
  const hasActiveRequestFilters = hasActiveRequestRecordFilters(filters)
  const visibleTableWidth =
    visibleColumnConfigs.reduce(
      (width, column) => width + column.width,
      usageRecordActionColumnWidth,
    ) + 16
  const toggleColumn = (column: UsageRecordColumnKey, checked: boolean) => {
    const config = usageRecordColumns.find((item) => item.key === column)
    if (config?.required && !checked) return

    setVisibleColumns((currentColumns) => {
      if (checked) {
        return currentColumns.includes(column) ? currentColumns : [...currentColumns, column]
      }

      return currentColumns.filter((item) => item !== column)
    })
  }
  const applySort = (sort: UsageFilters['sort']) => {
    onFilterChange({ sort, offset: 0 })
  }

  return (
    <TableSurface className="min-w-0">
      <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-start md:justify-between">
        <SectionHeader title={t('usageLogsPage.records.title')} />
        {records && rows.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={usageTouchButtonClassName}
              disabled={!canExport || isExporting || mutating}
              onClick={onExport}
            >
              {isExporting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              {canExport
                ? t('usageLogsPage.actions.exportFilteredCsv')
                : t('usageLogsPage.actions.exportUnsupported')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={usageTouchButtonClassName}
                >
                  <Columns3 className="size-4" aria-hidden="true" />
                  {t('actions.customizeColumns')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>{t('usageLogsPage.records.columnsMenu')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {usageRecordColumns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={isColumnVisible(column.key)}
                    disabled={column.required}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(checked) => toggleColumn(column.key, Boolean(checked))}
                  >
                    {t(`usageLogsPage.records.columns.${column.key}`)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>
      {records ? (
        <div className="border-b px-3 py-3">
          <RequestRecordFiltersToolbar
            filters={filters}
            options={filterOptions}
            disabled={mutating}
            onChange={onFilterChange}
          />
        </div>
      ) : null}
      {records ? (
        rows.length > 0 ? (
          <div className="px-3 py-3">
            <Table
              containerClassName={cn(
                containedTableContainerClassName,
                'max-h-[min(660px,calc(100vh-260px))] rounded-md border',
              )}
              className="table-fixed"
              style={{ minWidth: visibleTableWidth }}
            >
              <TableHeader className={stickyTableHeaderClassName}>
                <TableRow variant="static">
                  {visibleColumnConfigs.map((column) => (
                    <UsageRecordTableHead
                      key={column.key}
                      column={column}
                      sort={filters.sort}
                      sortableFields={records.sortableFields}
                      disabled={mutating}
                      onSortChange={applySort}
                    />
                  ))}
                  <TableHead
                    className="table-sticky-action-head text-right"
                    style={{ width: usageRecordActionColumnWidth }}
                  >
                    {t('usageLogsPage.records.columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((record) => (
                  <TableRow key={record.id} variant="resource">
                    {isColumnVisible('time') ? (
                      <TableCell className="text-muted-foreground truncate">
                        {formatDateTime(record.timestamp, i18n) ?? record.timestamp}
                      </TableCell>
                    ) : null}
                    {isColumnVisible('status') ? (
                      <TableCell>
                        <StatusBadge record={record} />
                      </TableCell>
                    ) : null}
                    {isColumnVisible('model') ? (
                      <TableCell className="min-w-0">
                        <RequestModelCell record={record} />
                      </TableCell>
                    ) : null}
                    {isColumnVisible('client') ? (
                      <TableCell className="min-w-0">
                        <UsageCallerCell client={record.client} />
                      </TableCell>
                    ) : null}
                    {isColumnVisible('credential') ? (
                      <TableCell className="min-w-0">
                        <div className="flex items-center gap-2">
                          <CredentialBadge credential={record.credential} />
                          <span className="min-w-0 truncate text-sm">
                            {record.credential?.label ?? t('usageLogsPage.status.notAvailable')}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-1 truncate font-mono text-xs">
                          {record.credential?.authIndex ?? t('usageLogsPage.status.notAvailable')}
                        </p>
                      </TableCell>
                    ) : null}
                    {isColumnVisible('tokens') ? (
                      <TableCell className="text-right">
                        <p className="font-medium">
                          {formatCompactNumber(record.tokens.totalTokens)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatCompactNumber(record.tokens.inputTokens)} /{' '}
                          {formatCompactNumber(record.tokens.outputTokens)}
                        </p>
                      </TableCell>
                    ) : null}
                    {isColumnVisible('performance') ? (
                      <TableCell className="text-right">
                        <p className="font-medium">
                          {formatDuration(record.performance.latencyMs) ??
                            t('usageLogsPage.status.notAvailable')}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {t('usageLogsPage.records.ttft', {
                            value:
                              formatDuration(record.performance.ttftMs) ??
                              t('usageLogsPage.status.notAvailable'),
                          })}
                        </p>
                      </TableCell>
                    ) : null}
                    {isColumnVisible('cost') ? (
                      <TableCell className="text-right">
                        {formatAmountUnit(
                          t,
                          record.billing?.amount ?? null,
                          record.billing?.currency,
                        ) ?? t('usageLogsPage.status.notAvailable')}
                      </TableCell>
                    ) : null}
                    {isColumnVisible('request') ? (
                      <TableCell className="min-w-0">
                        <p className="truncate font-mono text-xs">
                          {record.requestId ?? t('usageLogsPage.status.unknownRequest')}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {formatHomeEndpoint(record.runtime.homeIp, record.runtime.homePort) ??
                            t('usageLogsPage.status.localHome')}
                        </p>
                      </TableCell>
                    ) : null}
                    <TableCell
                      className="table-sticky-action-cell text-right transition-colors"
                      style={{ width: usageRecordActionColumnWidth }}
                    >
                      <div className="table-action-cell-content">
                        <Button
                          type="button"
                          variant="text"
                          size="sm"
                          className={usageTouchButtonClassName}
                          onClick={() => onInspect(record)}
                        >
                          <Eye className="size-4" aria-hidden="true" />
                          {t('usageLogsPage.actions.viewRecordDetail')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <TableEmptyState
            kind={hasActiveRequestFilters ? 'filtered-empty' : 'empty'}
            title={t('usageLogsPage.records.emptyTitle')}
            description={t('usageLogsPage.records.emptyDescription')}
            action={
              hasActiveRequestFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={usageTouchButtonClassName}
                  disabled={mutating}
                  onClick={() => onFilterChange(getClearedRequestRecordFilters())}
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  {t('usageLogsPage.records.clearFilters')}
                </Button>
              ) : null
            }
          />
        )
      ) : errorMessage ? (
        <TableEmptyState
          kind="error"
          title={t('usageLogsPage.records.errorTitle')}
          description={errorMessage}
        />
      ) : (
        <TableEmptyState
          kind={unavailable ? 'unsupported' : 'empty'}
          title={t(
            unavailable
              ? 'usageLogsPage.records.unavailableTitle'
              : 'usageLogsPage.records.emptyTitle',
          )}
          description={t(
            unavailable ? 'usageLogsPage.records.unavailable' : 'usageLogsPage.records.empty',
          )}
        />
      )}
      {records && total > 0 ? (
        <div className="border-border/80 bg-muted/20 flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <TablePaginationStatus
            text={t('usageLogsPage.records.range', {
              start: formatNumber(start),
              end: formatNumber(end),
              total: formatNumber(total),
            })}
            announcementKey={JSON.stringify(filters)}
            busy={fetching || mutating}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {t('usageLogsPage.records.pageSize')}
              </span>
              <Select
                value={String(filters.limit)}
                disabled={mutating}
                onValueChange={(nextValue) => onLimitChange(Number(nextValue))}
              >
                <SelectTrigger
                  className={cn(usageTouchControlClassName, 'w-24')}
                  size="sm"
                  aria-label={t('usageLogsPage.records.pageSize')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {formatNumber(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={usageTouchButtonClassName}
                disabled={!canGoPrevious || mutating}
                onClick={() => onOffsetChange(Math.max(0, filters.offset - filters.limit))}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                {t('usageLogsPage.records.previous')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={usageTouchButtonClassName}
                disabled={!canGoNext || mutating}
                onClick={() => onOffsetChange(filters.offset + filters.limit)}
              >
                {t('usageLogsPage.records.next')}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </TableSurface>
  )
}

type RequestLogSortKey = 'time' | 'size'

function RequestLogSortButton({
  label,
  sortKey,
  activeKey,
  direction,
  align = 'left',
  disabled,
  onSort,
}: {
  label: string
  sortKey: RequestLogSortKey
  activeKey: RequestLogSortKey
  direction: 'asc' | 'desc'
  align?: 'left' | 'right'
  disabled: boolean
  onSort: (key: RequestLogSortKey) => void
}) {
  const active = activeKey === sortKey
  const Icon = active ? (direction === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSort(sortKey)}
      className={cn(
        'hover:bg-background/80 focus-visible:ring-ring -mx-2 inline-flex h-8 max-w-full items-center gap-1.5 rounded-md px-2 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        align === 'right' && 'ml-auto justify-end text-right',
        active && 'text-foreground',
      )}
    >
      <span className="truncate">{label}</span>
      <Icon
        className={cn(
          'size-3 shrink-0 stroke-[2.5]',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
        aria-hidden="true"
      />
    </button>
  )
}

export function RequestLogIndexTable({
  index,
  updatedAt,
  mutating,
  downloadingRequestLogId,
  isDownloadingRequestLog,
  onDownloadRequestLog,
  onAutoRefreshEligibilityChange,
}: {
  index: RequestLogIndex | null
  updatedAt?: string | null
  mutating: boolean
  downloadingRequestLogId: string | null
  isDownloadingRequestLog: boolean
  onDownloadRequestLog: (
    requestId: string,
    homeIp?: string | null,
    homePort?: number | null,
  ) => void
  onAutoRefreshEligibilityChange?: (eligible: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: RequestLogSortKey; direction: 'asc' | 'desc' }>({
    key: 'time',
    direction: 'desc',
  })
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(0)
  const indexItems = index?.items ?? []

  useEffect(() => {
    onAutoRefreshEligibilityChange?.(page === 0 && sort.key === 'time' && sort.direction === 'desc')
  }, [onAutoRefreshEligibilityChange, page, sort.direction, sort.key])

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return indexItems

    return indexItems.filter((row) =>
      [
        row.requestId,
        row.model,
        row.provider,
        formatHomeEndpoint(row.homeIp, row.homePort),
        row.fileName,
        row.status,
        row.id,
      ].some((value) => value?.toLowerCase().includes(normalizedSearch)),
    )
  }, [indexItems, search])

  const sortedRows = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1
    return [...filteredRows].sort((left, right) => {
      if (sort.key === 'size') {
        return ((left.sizeBytes ?? 0) - (right.sizeBytes ?? 0)) * factor
      }
      const leftTime = left.timestamp ? Date.parse(left.timestamp) || 0 : 0
      const rightTime = right.timestamp ? Date.parse(right.timestamp) || 0 : 0
      return (leftTime - rightTime) * factor
    })
  }, [filteredRows, sort])

  const totalRows = sortedRows.length
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const pageStart = currentPage * pageSize
  const rows = sortedRows.slice(pageStart, pageStart + pageSize)
  const hasSearch = search.trim().length > 0

  const handleSort = (key: RequestLogSortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' },
    )
    setPage(0)
  }

  if (!index) return null

  return (
    <TableSurface className="min-w-0">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeader title={t('usageLogsPage.requestLogs.title')} />
        <div className="flex min-w-0 flex-col gap-2 lg:w-80">
          {updatedAt ? (
            <p className="text-muted-foreground text-right text-xs">
              {t('usageLogsPage.header.updatedAt', {
                time: formatDateTime(updatedAt, i18n) ?? updatedAt,
              })}
            </p>
          ) : null}
          <div className="relative min-w-0">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              type="search"
              value={search}
              placeholder={t('usageLogsPage.requestLogs.searchPlaceholder')}
              disabled={mutating || index.items.length === 0}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(0)
              }}
            />
          </div>
        </div>
      </div>
      {totalRows > 0 ? (
        <Table containerClassName={containedTableContainerClassName} className="min-w-[1080px]">
          <TableHeader className={stickyTableHeaderClassName}>
            <TableRow variant="static">
              <TableHead
                className="w-[170px]"
                aria-sort={
                  sort.key === 'time'
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <RequestLogSortButton
                  label={t('usageLogsPage.requestLogs.columns.time')}
                  sortKey="time"
                  activeKey={sort.key}
                  direction={sort.direction}
                  disabled={mutating}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="w-[250px]">
                {t('usageLogsPage.requestLogs.columns.request')}
              </TableHead>
              <TableHead className="w-[180px]">
                {t('usageLogsPage.requestLogs.columns.model')}
              </TableHead>
              <TableHead className="w-[150px]">
                {t('usageLogsPage.requestLogs.columns.homeIp')}
              </TableHead>
              <TableHead className="w-[170px]">
                {t('usageLogsPage.requestLogs.columns.file')}
              </TableHead>
              <TableHead
                className="w-[100px] text-right"
                aria-sort={
                  sort.key === 'size'
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <RequestLogSortButton
                  label={t('usageLogsPage.requestLogs.columns.size')}
                  sortKey="size"
                  activeKey={sort.key}
                  direction={sort.direction}
                  align="right"
                  disabled={mutating}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="table-sticky-action-head w-[120px] text-right">
                {t('usageLogsPage.requestLogs.columns.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const downloading =
                isDownloadingRequestLog && downloadingRequestLogId === row.requestId

              return (
                <TableRow key={row.id} variant="resource" className="group">
                  <TableCell className="text-muted-foreground truncate">
                    {formatDateTime(row.timestamp, i18n) ?? t('usageLogsPage.status.notAvailable')}
                  </TableCell>
                  <TableCell className="min-w-0">
                    <p className="truncate font-mono text-xs">{row.requestId}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {row.status === 'failed'
                        ? t('usageLogsPage.status.failed')
                        : row.status === 'success'
                          ? t('usageLogsPage.status.success')
                          : t('usageLogsPage.status.notAvailable')}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-0">
                    <p className="truncate font-medium">
                      {row.model ?? t('usageLogsPage.status.notAvailable')}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {row.provider ?? t('usageLogsPage.status.notAvailable')}
                    </p>
                  </TableCell>
                  <TableCell className="text-muted-foreground truncate">
                    {formatHomeEndpoint(row.homeIp, row.homePort) ??
                      t('usageLogsPage.status.localHome')}
                  </TableCell>
                  <TableCell className="min-w-0">
                    <p className="truncate font-mono text-xs">
                      {row.fileName ?? t('usageLogsPage.requestLogs.inlineLog')}
                    </p>
                    {row.downloadUrl ? (
                      <p className="text-muted-foreground mt-1 truncate font-mono text-xs">
                        {row.downloadUrl}
                      </p>
                    ) : null}
                    {!row.available ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {t('usageLogsPage.requestLogs.unavailableFile')}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.sizeBytes === null
                      ? t('usageLogsPage.status.notAvailable')
                      : t('usageLogsPage.requestLogs.sizeBytes', {
                          size: formatBytes(row.sizeBytes),
                        })}
                  </TableCell>
                  <TableCell className="table-sticky-action-cell w-[120px] text-right transition-colors">
                    <div className="table-action-cell-content">
                      <Button
                        type="button"
                        variant="text"
                        size="sm"
                        disabled={!row.available || mutating}
                        onClick={() =>
                          onDownloadRequestLog(row.requestId, row.homeIp, row.homePort)
                        }
                      >
                        {downloading ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Download className="size-4" aria-hidden="true" />
                        )}
                        {t('usageLogsPage.actions.download')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      ) : (
        <TableEmptyState
          kind={hasSearch ? 'filtered-empty' : 'empty'}
          title={t('usageLogsPage.requestLogs.emptyTitle')}
          description={
            hasSearch
              ? t('usageLogsPage.requestLogs.emptyDescription')
              : t('usageLogsPage.requestLogs.empty')
          }
          action={
            hasSearch ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={usageTouchButtonClassName}
                disabled={mutating}
                onClick={() => {
                  setSearch('')
                  setPage(0)
                }}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {t('usageLogsPage.requestLogs.clearSearch')}
              </Button>
            ) : null
          }
        />
      )}
      {totalRows > 0 ? (
        <div className="border-border/80 bg-muted/20 flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <TablePaginationStatus
            text={t('usageLogsPage.records.range', {
              start: formatNumber(pageStart + 1),
              end: formatNumber(Math.min(pageStart + pageSize, totalRows)),
              total: formatNumber(totalRows),
            })}
            announcementKey={`${currentPage}:${pageSize}:${search}:${sort.key}:${sort.direction}`}
            busy={mutating}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {t('usageLogsPage.records.pageSize')}
              </span>
              <Select
                value={String(pageSize)}
                disabled={mutating}
                onValueChange={(nextValue) => {
                  setPageSize(Number(nextValue))
                  setPage(0)
                }}
              >
                <SelectTrigger
                  className="w-24"
                  size="sm"
                  aria-label={t('usageLogsPage.records.pageSize')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[20, 50, 100].map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {formatNumber(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 0 || mutating}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                {t('usageLogsPage.records.previous')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= pageCount - 1 || mutating}
                onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
              >
                {t('usageLogsPage.records.next')}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </TableSurface>
  )
}

function formatMetadataValue(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-1 min-w-0 truncate text-sm">{children}</div>
    </div>
  )
}

function getQuotaStatusClassName(window: UsageQuotaWindow) {
  if (window.status === 'exceeded') return 'text-destructive'
  if (window.status === 'warning') return 'text-warning-foreground dark:text-warning'
  if (window.status === 'ok') return 'text-success'
  return 'text-muted-foreground'
}

function getQuotaStatusBarClassName(window: UsageQuotaWindow) {
  if (window.status === 'exceeded') return 'bg-destructive'
  if (window.status === 'warning') return 'bg-warning'
  if (window.status === 'ok') return 'bg-success'
  return 'bg-muted-foreground/40'
}

function formatQuotaWindowLabel(window: UsageQuotaWindow, t: TFunction) {
  const normalizedLabel = window.label.trim().toLowerCase()
  if (normalizedLabel === 'weekly' || window.windowSeconds === 604_800) {
    return t('usageLogsPage.credentials.quotaWindowLabels.weekly')
  }

  if (window.windowSeconds) {
    const hours = window.windowSeconds / 3600
    if (Number.isInteger(hours) && hours < 24) {
      return t('usageLogsPage.credentials.quotaWindowLabels.hours', {
        count: formatNumber(hours),
      })
    }

    const days = window.windowSeconds / 86_400
    if (Number.isInteger(days)) {
      return t('usageLogsPage.credentials.quotaWindowLabels.days', {
        count: formatNumber(days),
      })
    }
  }

  return window.label || t('usageLogsPage.credentials.quotaWindowLabels.window')
}

function QuotaWindowProgress({ window }: { window: UsageQuotaWindow }) {
  const { t } = useTranslation()
  const percentage = window.percentage ?? 0
  const label = formatQuotaWindowLabel(window, t)

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-muted-foreground truncate text-xs font-medium">{label}</span>
          {window.mode === 'estimated' ? (
            <span className="border-warning/30 bg-warning/10 text-warning-foreground dark:text-warning rounded px-1 py-0.5 text-[10px] leading-none font-medium">
              {t('usageLogsPage.credentials.quotaModes.estimated')}
            </span>
          ) : null}
        </span>
        <span className={cn('text-xs font-semibold tabular-nums', getQuotaStatusClassName(window))}>
          {window.percentage === null ? '—' : formatPercent(window.percentage)}
        </span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className={cn('h-full rounded-full', getQuotaStatusBarClassName(window))}
          style={{ width: `${Math.max(2, Math.min(100, percentage * 100))}%` }}
        />
      </div>
      <p className="text-muted-foreground mt-1 truncate text-xs">
        {window.usedTokens === null
          ? t('usageLogsPage.credentials.quotaUnavailable')
          : t('usageLogsPage.credentials.quotaTokens', {
              used: formatCompactNumber(window.usedTokens),
              limit:
                window.limitTokens === null
                  ? t('usageLogsPage.status.notAvailable')
                  : formatCompactNumber(window.limitTokens),
            })}
      </p>
    </div>
  )
}

export function RequestDetailSheet({
  detail,
  pending,
  error,
  mutating,
  downloadingRequestLogId,
  isDownloadingRequestLog,
  onOpenChange,
  onDownloadRequestLog,
}: {
  detail: UsageRecordDetail | undefined
  pending: boolean
  error: string | null
  mutating: boolean
  downloadingRequestLogId: string | null
  isDownloadingRequestLog: boolean
  onOpenChange: (open: boolean) => void
  onDownloadRequestLog?: (
    requestId: string,
    homeIp?: string | null,
    homePort?: number | null,
  ) => void
}) {
  const { t, i18n } = useTranslation()
  const sheetContentRef = useRef<HTMLDivElement>(null)
  const record = detail?.record
  const relatedRequestLog = detail?.related?.requestLog
  const requestLogId = relatedRequestLog?.requestId ?? record?.requestId
  const requestLogHomeIp = relatedRequestLog?.homeIp ?? record?.runtime.homeIp
  const requestLogHomePort = relatedRequestLog?.homePort ?? record?.runtime.homePort
  const requestLogAvailable =
    relatedRequestLog?.available ?? record?.runtime.requestLogAvailable ?? false
  const requestLogHomeIpRequired = record?.runtime.logHomeIpRequired ?? false
  const requestLogRoutable =
    Boolean(requestLogId) &&
    requestLogAvailable &&
    (!requestLogHomeIpRequired || Boolean(requestLogHomeIp))
  const downloading =
    isDownloadingRequestLog && Boolean(requestLogId) && downloadingRequestLogId === requestLogId
  const canDownloadRequestLog = onDownloadRequestLog !== undefined && requestLogRoutable
  const requestLogStatus = !requestLogRoutable
    ? 'unavailable'
    : requestLogHomeIpRequired
      ? 'remote'
      : 'local'
  const copyLabel = t('usageLogsPage.detail.actions.copy')
  const copiedLabel = t('usageLogsPage.detail.actions.copied')
  const wrapLinesLabel = t('usageLogsPage.detail.actions.wrapLines')
  const preserveLinesLabel = t('usageLogsPage.detail.actions.preserveLines')

  return (
    <Sheet open={pending || Boolean(record) || Boolean(error)} onOpenChange={onOpenChange}>
      <SheetContent
        ref={sheetContentRef}
        className="w-full overflow-hidden p-0 focus:outline-hidden sm:max-w-3xl"
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          window.requestAnimationFrame(() => {
            sheetContentRef.current?.focus({ preventScroll: true })
          })
        }}
      >
        <SheetHeader className="min-w-0 border-b p-4">
          <SheetTitle>{t('usageLogsPage.detail.title')}</SheetTitle>
          <SheetDescription className="[overflow-wrap:anywhere] break-words">
            {record
              ? (formatDateTime(record.timestamp, i18n) ?? record.timestamp)
              : t('usageLogsPage.detail.loading')}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
          {pending ? (
            <div className="grid gap-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          ) : error ? (
            <p className="text-destructive text-sm [overflow-wrap:anywhere] break-words">{error}</p>
          ) : record ? (
            <div className="grid min-w-0 grid-cols-1 gap-5">
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <DiagnosticDetailField
                  label={t('usageLogsPage.detail.fields.requestId')}
                  copyValue={record.requestId}
                  copyLabel={copyLabel}
                  copiedLabel={copiedLabel}
                  mono
                >
                  {record.requestId ?? t('usageLogsPage.status.notAvailable')}
                </DiagnosticDetailField>
                <DiagnosticDetailField
                  label={t('usageLogsPage.detail.fields.usageId')}
                  copyValue={String(record.usageId)}
                  copyLabel={copyLabel}
                  copiedLabel={copiedLabel}
                  mono
                >
                  {record.usageId}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('usageLogsPage.detail.fields.status')}>
                  <StatusBadge record={record} />
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('usageLogsPage.detail.fields.homeIp')}>
                  {formatHomeEndpoint(record.runtime.homeIp, record.runtime.homePort) ??
                    t('usageLogsPage.status.localHome')}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('usageLogsPage.detail.fields.client')}>
                  {record.client?.username ?? t('usageLogsPage.caller.userNotRecorded')}
                </DiagnosticDetailField>
                <DiagnosticDetailField
                  label={t('usageLogsPage.detail.fields.clientKey')}
                  copyValue={record.client?.apiKeyLabel ?? record.client?.apiKeyMasked}
                  copyLabel={copyLabel}
                  copiedLabel={copiedLabel}
                  mono
                >
                  {record.client?.apiKeyLabel ??
                    record.client?.apiKeyMasked ??
                    t('usageLogsPage.caller.keyNotRecorded')}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('usageLogsPage.detail.fields.clientIp')} mono>
                  {record.client?.clientIp ?? t('usageLogsPage.caller.ipNotRecorded')}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('usageLogsPage.detail.fields.credential')}>
                  {record.credential?.label ?? t('usageLogsPage.status.notAvailable')}
                </DiagnosticDetailField>
                <DiagnosticDetailField
                  label={t('usageLogsPage.detail.fields.authIndex')}
                  copyValue={record.credential?.authIndex}
                  copyLabel={copyLabel}
                  copiedLabel={copiedLabel}
                  mono
                >
                  {record.credential?.authIndex ?? t('usageLogsPage.status.notAvailable')}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('usageLogsPage.detail.fields.model')}>
                  {record.provider} / {record.model}
                </DiagnosticDetailField>
                <DiagnosticDetailField
                  className="sm:col-span-2"
                  label={t('usageLogsPage.detail.fields.endpoint')}
                  copyValue={record.endpoint}
                  copyLabel={copyLabel}
                  copiedLabel={copiedLabel}
                  mono
                >
                  {record.endpoint ?? t('usageLogsPage.status.notAvailable')}
                </DiagnosticDetailField>
              </div>

              <div>
                <h3 className="text-sm font-medium">{t('usageLogsPage.detail.tokens')}</h3>
                <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    ['input', record.tokens.inputTokens],
                    ['output', record.tokens.outputTokens],
                    ['reasoning', record.tokens.reasoningTokens],
                    ['cacheRead', record.tokens.cacheReadTokens],
                    ['cacheCreate', record.tokens.cacheCreationTokens],
                    ['total', record.tokens.totalTokens],
                  ].map(([key, value]) => (
                    <DiagnosticDetailField
                      key={key}
                      label={t(`usageLogsPage.detail.tokenFields.${key}`)}
                    >
                      {formatNumber(Number(value))}
                    </DiagnosticDetailField>
                  ))}
                </div>
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <DiagnosticDetailField label={t('usageLogsPage.detail.fields.latency')}>
                  {formatDuration(record.performance.latencyMs)}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('usageLogsPage.detail.fields.ttft')}>
                  {formatDuration(record.performance.ttftMs) ??
                    t('usageLogsPage.status.notAvailable')}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('usageLogsPage.detail.fields.billing')}>
                  {formatAmountUnit(t, record.billing?.amount ?? null, record.billing?.currency) ??
                    t('usageLogsPage.status.notAvailable')}
                </DiagnosticDetailField>
                <DiagnosticDetailField
                  label={t('usageLogsPage.detail.fields.chargeId')}
                  copyValue={record.billing?.chargeId ?? detail?.related?.chargeId}
                  copyLabel={copyLabel}
                  copiedLabel={copiedLabel}
                  mono
                >
                  {record.billing?.chargeId ??
                    detail?.related?.chargeId ??
                    t('usageLogsPage.status.notAvailable')}
                </DiagnosticDetailField>
              </div>

              <div>
                <h3 className="text-sm font-medium">{t('usageLogsPage.detail.related')}</h3>
                <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                  <DiagnosticDetailField label={t('usageLogsPage.detail.relatedFields.requestLog')}>
                    {t(`usageLogsPage.detail.requestLogStatuses.${requestLogStatus}`)}
                  </DiagnosticDetailField>
                  <DiagnosticDetailField
                    label={t('usageLogsPage.detail.relatedFields.requestLogHomeIp')}
                  >
                    {formatHomeEndpoint(requestLogHomeIp ?? null, requestLogHomePort ?? null) ??
                      t('usageLogsPage.status.localHome')}
                  </DiagnosticDetailField>
                </div>
                {relatedRequestLog?.downloadUrl ? (
                  <Collapsible className="mt-3">
                    <CollapsibleTrigger className="group text-muted-foreground focus-visible:ring-ring/50 flex items-center gap-1.5 rounded-sm text-xs font-medium outline-none focus-visible:ring-[3px]">
                      {t('usageLogsPage.detail.technicalMetadata')}
                      <ChevronDown
                        className="size-3.5 transition-transform group-data-[state=open]:rotate-180"
                        aria-hidden="true"
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <DiagnosticDetailField
                        label={t('usageLogsPage.detail.relatedFields.downloadUrl')}
                        copyValue={relatedRequestLog.downloadUrl}
                        copyLabel={copyLabel}
                        copiedLabel={copiedLabel}
                        mono
                      >
                        {relatedRequestLog.downloadUrl}
                      </DiagnosticDetailField>
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
              </div>

              {record.error ? (
                <div>
                  <h3 className="text-sm font-medium">{t('usageLogsPage.detail.error')}</h3>
                  <TechnicalTextViewer
                    content={
                      record.error.bodyPreview ??
                      record.error.message ??
                      t('usageLogsPage.status.notAvailable')
                    }
                    copyLabel={copyLabel}
                    copiedLabel={copiedLabel}
                    wrapLinesLabel={wrapLinesLabel}
                    preserveLinesLabel={preserveLinesLabel}
                    maxHeightClassName="max-h-44"
                  />
                </div>
              ) : null}

              <div>
                <h3 className="text-sm font-medium">{t('usageLogsPage.detail.payload')}</h3>
                <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-4">
                  <DiagnosticDetailField label={t('usageLogsPage.detail.payloadFields.method')}>
                    {detail?.payloadSummary?.method ?? t('usageLogsPage.status.notAvailable')}
                  </DiagnosticDetailField>
                  <DiagnosticDetailField label={t('usageLogsPage.detail.payloadFields.stream')}>
                    {detail?.payloadSummary?.stream === null
                      ? t('usageLogsPage.status.notAvailable')
                      : detail?.payloadSummary?.stream
                        ? t('common.enabled')
                        : t('common.disabled')}
                  </DiagnosticDetailField>
                  <DiagnosticDetailField label={t('usageLogsPage.detail.payloadFields.messages')}>
                    {detail?.payloadSummary?.messageCount ?? t('usageLogsPage.status.notAvailable')}
                  </DiagnosticDetailField>
                  <DiagnosticDetailField label={t('usageLogsPage.detail.payloadFields.tools')}>
                    {detail?.payloadSummary?.toolCount ?? t('usageLogsPage.status.notAvailable')}
                  </DiagnosticDetailField>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium">{t('usageLogsPage.detail.logs')}</h3>
                <TechnicalTextViewer
                  content={
                    detail?.logExcerpt.length
                      ? detail.logExcerpt.join('\n')
                      : t('usageLogsPage.detail.noLogExcerpt')
                  }
                  copyLabel={copyLabel}
                  copiedLabel={copiedLabel}
                  wrapLinesLabel={wrapLinesLabel}
                  preserveLinesLabel={preserveLinesLabel}
                  maxHeightClassName="max-h-52"
                />
              </div>
            </div>
          ) : null}
        </div>
        {onDownloadRequestLog && record ? (
          <div className="bg-popover flex flex-col border-t p-4 sm:items-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={!canDownloadRequestLog || mutating}
              onClick={() =>
                requestLogId &&
                onDownloadRequestLog(requestLogId, requestLogHomeIp, requestLogHomePort)
              }
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              {downloading
                ? t('usageLogsPage.detail.downloadingRequestLog')
                : t('usageLogsPage.actions.downloadRequestLog')}
            </Button>
            {!canDownloadRequestLog ? (
              <p className="text-muted-foreground mt-2 text-xs sm:text-right">
                {t('usageLogsPage.detail.requestLogUnavailable')}
              </p>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

type CredentialUsageColumnKey =
  | 'credential'
  | 'provider'
  | 'status'
  | 'requests'
  | 'tokens'
  | 'cost'
  | 'quota'
  | 'lastUsed'

const credentialUsageColumns: Array<{
  key: CredentialUsageColumnKey
  width: number
  align?: 'right'
  required?: boolean
}> = [
  { key: 'credential', width: 270, required: true },
  { key: 'provider', width: 170 },
  { key: 'status', width: 160 },
  { key: 'requests', width: 160, align: 'right' },
  { key: 'tokens', width: 170, align: 'right' },
  { key: 'cost', width: 120, align: 'right' },
  { key: 'quota', width: 260 },
  { key: 'lastUsed', width: 170 },
]

const defaultCredentialUsageColumns = credentialUsageColumns.map((column) => column.key)

const credentialUsageSortableMetrics: Partial<
  Record<CredentialUsageColumnKey, UsageAggregateMetric>
> = {
  requests: 'request_count',
  tokens: 'total_tokens',
  cost: 'total_amount',
}

function normalizeCredentialStatus(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  return normalized
}

function credentialStatusToneClassName(status: string | null) {
  if (status === 'active' || status === 'enabled') return 'bg-success'
  if (status === 'disabled' || status === 'inactive') return 'bg-muted-foreground'
  if (status === 'error' || status === 'failed') return 'bg-destructive'
  if (status === 'warning' || status === 'limited') return 'bg-warning'
  if (status === 'unavailable') return 'bg-warning'
  return 'bg-muted-foreground/45'
}

function CredentialUsageStatusText({ status }: { status: unknown }) {
  const { t } = useTranslation()
  const normalizedStatus = normalizeCredentialStatus(status)
  const statusLabel = normalizedStatus
    ? t(`usageLogsPage.credentials.statuses.${normalizedStatus}`, {
        defaultValue: formatMetadataValue(status, t('usageLogsPage.status.notAvailable')),
      })
    : t('usageLogsPage.status.notAvailable')

  return (
    <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1.5 text-xs">
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          credentialStatusToneClassName(normalizedStatus),
        )}
        aria-hidden="true"
      />
      <span className="truncate">{statusLabel}</span>
    </span>
  )
}

function CredentialUsageTableHead({
  column,
  sort,
  sortableMetrics,
  disabled,
  onSortChange,
}: {
  column: (typeof credentialUsageColumns)[number]
  sort: UsageAggregateSortState
  sortableMetrics: UsageAggregateMetric[]
  disabled: boolean
  onSortChange: (metric: UsageAggregateMetric) => void
}) {
  const { t } = useTranslation()
  const label = t(`usageLogsPage.credentials.columns.${column.key}`)
  const metric = credentialUsageSortableMetrics[column.key]

  if (!metric || !sortableMetrics.includes(metric)) {
    return (
      <TableHead
        className={cn(column.align === 'right' && 'text-right')}
        style={{ width: column.width }}
      >
        {label}
      </TableHead>
    )
  }

  const activeDirection = sort?.metric === metric ? sort.direction : null
  const nextDirection = !activeDirection ? 'desc' : activeDirection === 'desc' ? 'asc' : null
  const Icon = activeDirection
    ? activeDirection === 'asc'
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown
  const sortLabel = nextDirection
    ? t(`usageLogsPage.credentials.sortDirections.${nextDirection}`)
    : null

  return (
    <TableHead
      aria-sort={
        activeDirection ? (activeDirection === 'asc' ? 'ascending' : 'descending') : 'none'
      }
      className={cn(column.align === 'right' && 'text-right')}
      style={{ width: column.width }}
    >
      <button
        type="button"
        className={cn(
          'hover:bg-background/80 focus-visible:ring-ring -mx-2 inline-flex h-8 max-w-full items-center gap-1.5 rounded-md px-2 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
          column.align === 'right' && 'ml-auto justify-end text-right',
          activeDirection && 'text-foreground',
        )}
        disabled={disabled}
        onClick={() => onSortChange(metric)}
        aria-label={
          sortLabel
            ? t('usageLogsPage.credentials.sortColumn', {
                column: label,
                direction: sortLabel,
              })
            : t('usageLogsPage.credentials.clearSortColumn', { column: label })
        }
        title={
          sortLabel
            ? t('usageLogsPage.credentials.sortColumn', {
                column: label,
                direction: sortLabel,
              })
            : t('usageLogsPage.credentials.clearSortColumn', { column: label })
        }
      >
        <span className="truncate">{label}</span>
        <Icon
          className={cn(
            'size-3 shrink-0 stroke-[2.5]',
            activeDirection ? 'text-foreground' : 'text-muted-foreground',
          )}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  )
}

export function CredentialUsageTable({
  response,
  pageSizeOptions,
  sort,
  pending,
  unavailable,
  errorMessage,
  mutating,
  onSortChange,
  onLimitChange,
  onOffsetChange,
}: {
  response: UsageLogsSnapshot['credentialUsage']
  pageSizeOptions: number[]
  sort: UsageAggregateSortState
  pending: boolean
  unavailable: boolean
  errorMessage: string | null
  mutating: boolean
  onSortChange: (metric: UsageAggregateMetric) => void
  onLimitChange: (limit: number) => void
  onOffsetChange: (offset: number) => void
}) {
  const { t, i18n } = useTranslation()
  const [visibleColumns, setVisibleColumns] = useState<CredentialUsageColumnKey[]>(
    defaultCredentialUsageColumns,
  )
  const rows = response?.items ?? []
  const total = response?.total ?? 0
  const limit = response?.limit ?? pageSizeOptions[0] ?? 20
  const offset = response?.offset ?? 0
  const start = total > 0 ? offset + 1 : 0
  const end = Math.min(offset + rows.length, total)
  const canGoPrevious = offset > 0
  const canGoNext = offset + limit < total
  const controlsDisabled = pending || mutating
  const isColumnVisible = (column: CredentialUsageColumnKey) => visibleColumns.includes(column)
  const visibleColumnConfigs = credentialUsageColumns.filter((column) =>
    isColumnVisible(column.key),
  )
  const visibleTableWidth =
    visibleColumnConfigs.reduce((width, column) => width + column.width, 0) + 16
  const toggleColumn = (column: CredentialUsageColumnKey, checked: boolean) => {
    const config = credentialUsageColumns.find((item) => item.key === column)
    if (config?.required && !checked) return

    setVisibleColumns((currentColumns) => {
      if (checked) {
        return currentColumns.includes(column) ? currentColumns : [...currentColumns, column]
      }

      return currentColumns.filter((item) => item !== column)
    })
  }

  return (
    <TableSurface className="min-w-0">
      <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-start md:justify-between">
        <SectionHeader title={t('usageLogsPage.credentials.title')} />
        {response && rows.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={usageTouchButtonClassName}
                >
                  <Columns3 className="size-4" aria-hidden="true" />
                  {t('actions.customizeColumns')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>{t('usageLogsPage.credentials.columnsMenu')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {credentialUsageColumns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={isColumnVisible(column.key)}
                    disabled={column.required}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(checked) => toggleColumn(column.key, Boolean(checked))}
                  >
                    {t(`usageLogsPage.credentials.columns.${column.key}`)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>
      {pending && !response ? (
        <div className="grid gap-2 px-3 py-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 rounded-md" />
          ))}
        </div>
      ) : response ? (
        rows.length > 0 ? (
          <div className="px-3 py-3">
            <Table
              containerClassName={cn(containedTableContainerClassName, 'rounded-md border')}
              className="table-fixed"
              style={{ minWidth: visibleTableWidth }}
            >
              <TableHeader className={stickyTableHeaderClassName}>
                <TableRow variant="static">
                  {visibleColumnConfigs.map((column) => (
                    <CredentialUsageTableHead
                      key={column.key}
                      column={column}
                      sort={sort}
                      sortableMetrics={response.sortableMetrics}
                      disabled={controlsDisabled}
                      onSortChange={onSortChange}
                    />
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const credentialType =
                    typeof row.metadata.credential_type === 'string'
                      ? (row.metadata.credential_type as UsageCredentialType)
                      : 'unknown'
                  const provider =
                    typeof row.metadata.provider === 'string' && row.metadata.provider.trim()
                      ? row.metadata.provider
                      : null

                  return (
                    <TableRow key={row.id} variant="resource">
                      {isColumnVisible('credential') ? (
                        <TableCell className="min-w-0">
                          <p className="truncate font-medium">{row.label}</p>
                          <p className="text-muted-foreground truncate font-mono text-xs">
                            {formatMetadataValue(row.metadata.auth_index, row.id)}
                          </p>
                        </TableCell>
                      ) : null}
                      {isColumnVisible('provider') ? (
                        <TableCell className="min-w-0">
                          <ProviderValueCell
                            provider={provider}
                            fallback={t('usageLogsPage.status.notAvailable')}
                          />
                        </TableCell>
                      ) : null}
                      {isColumnVisible('status') ? (
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md border px-2 py-1 text-xs">
                              {t(`usageLogsPage.credentialTypes.${credentialType}`)}
                            </span>
                            <CredentialUsageStatusText status={row.metadata.status} />
                          </div>
                        </TableCell>
                      ) : null}
                      {isColumnVisible('requests') ? (
                        <TableCell className="text-right">
                          <p className="font-medium">{formatNumber(row.requestCount)}</p>
                          <p className="text-muted-foreground flex items-center justify-end gap-1.5 text-xs">
                            <MetricDelta delta={row.comparison?.requestCountDelta} />
                            <span>
                              {formatPercent(row.successRate)} · {formatNumber(row.failedCount)}{' '}
                              {t('usageLogsPage.credentials.failedShort')}
                            </span>
                          </p>
                        </TableCell>
                      ) : null}
                      {isColumnVisible('tokens') ? (
                        <TableCell className="text-right">
                          <p className="font-medium">{formatCompactNumber(row.totalTokens)}</p>
                          <p className="text-muted-foreground flex items-center justify-end gap-1.5 text-xs">
                            <MetricDelta delta={row.comparison?.totalTokensDelta} />
                            <span>
                              {t('usageLogsPage.credentials.cacheRate', {
                                value: row.cacheRate === null ? '—' : formatPercent(row.cacheRate),
                              })}
                            </span>
                          </p>
                        </TableCell>
                      ) : null}
                      {isColumnVisible('cost') ? (
                        <TableCell className="text-right">
                          <p className="font-medium">
                            {formatAmountUnit(t, row.totalAmount, row.currency) ??
                              t('usageLogsPage.status.notAvailable')}
                          </p>
                          <p className="text-muted-foreground flex justify-end text-xs">
                            <MetricDelta delta={row.comparison?.totalAmountDelta} />
                          </p>
                        </TableCell>
                      ) : null}
                      {isColumnVisible('quota') ? (
                        <TableCell>
                          {row.quotaWindows.length > 0 ? (
                            <div className="grid gap-2">
                              {row.quotaWindows.slice(0, 2).map((window) => (
                                <QuotaWindowProgress key={window.label} window={window} />
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              {t('usageLogsPage.credentials.quotaUnavailable')}
                            </span>
                          )}
                        </TableCell>
                      ) : null}
                      {isColumnVisible('lastUsed') ? (
                        <TableCell className="text-muted-foreground truncate">
                          {formatDateTime(row.lastUsedAt, i18n) ??
                            t('usageLogsPage.status.notAvailable')}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <TableEmptyState
            kind="empty"
            title={t('usageLogsPage.credentials.emptyTitle')}
            description={t('usageLogsPage.credentials.empty')}
          />
        )
      ) : errorMessage ? (
        <TableEmptyState
          kind="error"
          title={t('usageLogsPage.credentials.errorTitle')}
          description={errorMessage}
        />
      ) : (
        <TableEmptyState
          kind={unavailable ? 'unsupported' : 'empty'}
          title={t(
            unavailable
              ? 'usageLogsPage.credentials.unavailableTitle'
              : 'usageLogsPage.credentials.emptyTitle',
          )}
          description={t(
            unavailable
              ? 'usageLogsPage.credentials.unavailable'
              : 'usageLogsPage.credentials.empty',
          )}
        />
      )}
      {response && total > 0 ? (
        <div className="border-border/80 bg-muted/20 flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <TablePaginationStatus
            text={t('usageLogsPage.credentials.range', {
              start: formatNumber(start),
              end: formatNumber(end),
              total: formatNumber(total),
            })}
            announcementKey={`${offset}:${limit}:${JSON.stringify(sort)}`}
            busy={controlsDisabled}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {t('usageLogsPage.credentials.pageSize')}
              </span>
              <Select
                value={String(limit)}
                disabled={controlsDisabled}
                onValueChange={(nextValue) => onLimitChange(Number(nextValue))}
              >
                <SelectTrigger
                  className={cn(usageTouchControlClassName, 'w-24')}
                  size="sm"
                  aria-label={t('usageLogsPage.credentials.pageSize')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {formatNumber(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={usageTouchButtonClassName}
                disabled={!canGoPrevious || controlsDisabled}
                onClick={() => onOffsetChange(Math.max(0, offset - limit))}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                {t('usageLogsPage.credentials.previous')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={usageTouchButtonClassName}
                disabled={!canGoNext || controlsDisabled}
                onClick={() => onOffsetChange(offset + limit)}
              >
                {t('usageLogsPage.credentials.next')}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </TableSurface>
  )
}

export function ActivityHeatmap({
  overview,
  updatedAt,
}: {
  overview: UsageOverview | null
  updatedAt?: string | null
}) {
  const { t, i18n } = useTranslation()
  const buckets = overview?.activity ?? []
  const activeBuckets = buckets.filter((bucket) => bucket.requestCount > 0).length
  const requestCount = buckets.reduce((sum, bucket) => sum + bucket.requestCount, 0)
  const successCount = buckets.reduce((sum, bucket) => sum + bucket.successCount, 0)
  const successRate = requestCount > 0 ? successCount / requestCount : 0
  const rangeLabel =
    overview?.range.from && overview.range.to
      ? t('usageLogsPage.activity.range', {
          from: formatShortDateTime(overview.range.from, i18n),
          to: formatShortDateTime(overview.range.to, i18n),
          interval: t(`usageLogsPage.activity.interval.${overview.range.interval}`, {
            defaultValue: overview.range.interval,
          }),
        })
      : null
  const legendStatuses = [
    'healthy',
    'degraded',
    'unavailable',
    'empty',
    ...(buckets.some((bucket) => bucket.status === 'unknown') ? (['unknown'] as const) : []),
  ] as const
  const matrixBuckets: UsageActivityMatrixBucket[] = buckets.map((bucket) => ({
    id: `${bucket.bucketStart}:${bucket.bucketEnd}`,
    label: `${bucket.bucketStart} - ${bucket.bucketEnd}`,
    requestCount: bucket.requestCount,
    successRate: bucket.successRate,
    status: bucket.status,
  }))
  const getBucketLabel = (bucket: UsageActivityMatrixBucket) =>
    `${bucket.label
      .split(' - ')
      .map((value) => formatShortDateTime(value, i18n))
      .join(' – ')}: ${formatNumber(bucket.requestCount)} · ${formatPercent(bucket.successRate)}`

  return (
    <TableSurface className="min-w-0 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <SectionHeader title={t('usageLogsPage.activity.title')} />
        <div className="text-muted-foreground text-right text-sm">
          <p>
            {t('usageLogsPage.activity.summary', {
              activeBuckets: formatNumber(activeBuckets),
              totalBuckets: formatNumber(buckets.length),
              requests: formatNumber(requestCount),
              successRate: formatPercent(successRate),
            })}
          </p>
          {updatedAt ? (
            <p className="mt-1 text-xs">
              {t('usageLogsPage.header.updatedAt', {
                time: formatDateTime(updatedAt, i18n) ?? updatedAt,
              })}
            </p>
          ) : null}
        </div>
      </div>
      {buckets.length > 0 ? (
        <>
          <div className="mt-4">
            {rangeLabel ? (
              <p className="text-foreground text-xs font-medium">{rangeLabel}</p>
            ) : null}
            <UsageActivityMatrix
              ariaLabel={t('usageLogsPage.activity.matrixLabel')}
              buckets={matrixBuckets}
              className={rangeLabel ? 'mt-2' : undefined}
              getBucketLabel={getBucketLabel}
              getStatusClassName={getActivityBucketClassName}
              getStatusLabel={(status) => t(`usageLogsPage.activity.status.${status}`)}
            />
          </div>
          <div className="text-muted-foreground mt-3 flex flex-wrap gap-3 text-xs">
            {legendStatuses.map((status) => (
              <span key={status} className="inline-flex items-center gap-1.5">
                <span className={cn('size-2 rounded-[2px]', getActivityBucketClassName(status))} />
                {t(`usageLogsPage.activity.status.${status}`)}
              </span>
            ))}
          </div>
        </>
      ) : (
        <TableEmptyState
          kind="empty"
          className="m-0 mt-4 min-h-32"
          title={t('usageLogsPage.activity.emptyTitle')}
          description={t('usageLogsPage.activity.unavailable')}
        />
      )}
    </TableSurface>
  )
}

function getActivityBucketClassName(status: UsageOverview['activity'][number]['status']) {
  if (status === 'healthy') return 'bg-success/85'
  if (status === 'degraded') return 'bg-warning/85'
  if (status === 'unavailable') return 'bg-destructive/85'
  if (status === 'unknown') return 'bg-info/65'
  return 'bg-muted'
}

function getUsageHealthStatusClassName(status: UsageHealthStatus) {
  if (status === 'healthy') return 'border-success/30 bg-success/10 text-success'
  if (status === 'degraded') {
    return 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
  }
  if (status === 'unavailable') {
    return 'border-destructive/30 bg-destructive/10 text-destructive'
  }
  if (status === 'disabled') return 'border-border bg-muted/50 text-muted-foreground'
  return 'border-border bg-muted/50 text-muted-foreground'
}

function UsageHealthStatusBadge({ status }: { status: UsageHealthStatus }) {
  const { t } = useTranslation()

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
        getUsageHealthStatusClassName(status),
      )}
    >
      {t(`usageLogsPage.health.status.${status}`)}
    </span>
  )
}

function UsageHealthMiniTable({
  response,
  title,
  updatedAt,
}: {
  response: UsageHealthResponse | null
  title: string
  updatedAt?: string | null
}) {
  const { t, i18n } = useTranslation()
  const rows = response?.items ?? []
  const degradedCount = rows.filter((item) =>
    ['degraded', 'unavailable', 'disabled'].includes(item.status),
  ).length

  return (
    <div className="flex min-h-[492px] min-w-0 flex-col">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader title={title} />
        {response ? (
          <div className="text-muted-foreground text-right text-sm">
            <p>
              {t('usageLogsPage.health.summary', {
                count: formatNumber(rows.length),
                issues: formatNumber(degradedCount),
                window:
                  formatDuration(response.windowSeconds * 1000) ?? `${response.windowSeconds}s`,
              })}
            </p>
            {updatedAt ? (
              <p className="mt-1 text-xs">
                {t('usageLogsPage.header.updatedAt', {
                  time: formatDateTime(updatedAt, i18n) ?? updatedAt,
                })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {response ? (
        rows.length > 0 ? (
          <Table
            containerClassName="h-[420px] overflow-auto rounded-md border"
            className="min-w-[760px] table-fixed"
          >
            <TableHeader className={stickyTableHeaderClassName}>
              <TableRow variant="static">
                <TableHead className="w-[220px]">
                  {t('usageLogsPage.health.columns.target')}
                </TableHead>
                <TableHead className="w-[120px]">
                  {t('usageLogsPage.health.columns.status')}
                </TableHead>
                <TableHead className="w-[160px] text-right">
                  {t('usageLogsPage.health.columns.recent')}
                </TableHead>
                <TableHead className="w-[130px] text-right">
                  {t('usageLogsPage.health.columns.latency')}
                </TableHead>
                <TableHead className="w-[130px]">
                  {t('usageLogsPage.health.columns.lastError')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={`${response.subject}:${item.id}`} variant="resource">
                  <TableCell className="min-w-0">
                    <p className="truncate font-medium">{item.label}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {item.provider ?? item.id}
                      {item.credentialType ? (
                        <>
                          {' · '}
                          {t(`usageLogsPage.credentialTypes.${item.credentialType}`)}
                        </>
                      ) : null}
                    </p>
                  </TableCell>
                  <TableCell>
                    <UsageHealthStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <p className="font-medium">
                      {formatPercent(1 - item.recentErrorRate)}
                      <span className="text-muted-foreground ml-1 text-xs">
                        {t('usageLogsPage.health.successShort')}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatNumber(item.recentSuccessCount)} /{' '}
                      {formatNumber(item.recentFailedCount)} {t('usageLogsPage.health.failedShort')}
                    </p>
                  </TableCell>
                  <TableCell className="text-right">
                    <p className="font-medium">
                      {formatDuration(item.p95LatencyMs) ?? t('usageLogsPage.status.notAvailable')}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t('usageLogsPage.health.avgLatency', {
                        value:
                          formatDuration(item.avgLatencyMs) ??
                          t('usageLogsPage.status.notAvailable'),
                      })}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-0">
                    {item.lastErrorAt ? (
                      <>
                        <p className="truncate font-mono text-xs">
                          {item.lastErrorStatus ?? t('usageLogsPage.status.notAvailable')}
                        </p>
                        <p
                          className="text-muted-foreground truncate text-xs"
                          title={item.lastErrorMessage ?? undefined}
                        >
                          {item.lastErrorMessage ?? formatDateTime(item.lastErrorAt, i18n)}
                        </p>
                        {item.nextRetryAt ? (
                          <p className="text-muted-foreground truncate text-xs">
                            {t('usageLogsPage.health.nextRetry', {
                              time: formatDateTime(item.nextRetryAt, i18n) ?? item.nextRetryAt,
                            })}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        {t('usageLogsPage.health.noError')}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <TableEmptyState
            kind="empty"
            className="m-0 min-h-[420px]"
            title={t('usageLogsPage.health.emptyTitle')}
            description={t('usageLogsPage.health.empty')}
          />
        )
      ) : (
        <TableEmptyState
          kind="unsupported"
          className="m-0 min-h-[420px]"
          title={t('usageLogsPage.health.unavailableTitle')}
          description={t('usageLogsPage.health.unavailable')}
        />
      )}
    </div>
  )
}

export function UsageHealthPanel({
  providerHealth,
  credentialHealth,
  providerUpdatedAt,
  credentialUpdatedAt,
}: {
  providerHealth: UsageHealthResponse | null
  credentialHealth: UsageHealthResponse | null
  providerUpdatedAt?: string | null
  credentialUpdatedAt?: string | null
}) {
  const { t } = useTranslation()

  if (!providerHealth && !credentialHealth) return null

  return (
    <TableSurface className="min-w-0 p-4">
      <div className="mb-4">
        <SectionHeader title={t('usageLogsPage.health.title')} />
      </div>
      <div className="grid items-stretch gap-5 xl:grid-cols-2">
        <UsageHealthMiniTable
          response={providerHealth}
          title={t('usageLogsPage.health.providers.title')}
          updatedAt={providerUpdatedAt}
        />
        <UsageHealthMiniTable
          response={credentialHealth}
          title={t('usageLogsPage.health.credentials.title')}
          updatedAt={credentialUpdatedAt}
        />
      </div>
    </TableSurface>
  )
}

export function SummaryCards({ snapshot }: { snapshot: UsageLogsSnapshot }) {
  const { t } = useTranslation()
  const totals = getUsageTotals(snapshot.apiKeyUsage)
  const cards = [
    {
      label: t('usageLogsPage.summary.keys'),
      value: formatNumber(snapshot.apiKeyUsage.length),
      detail: t('usageLogsPage.summary.keysDetail', {
        count: formatNumber(totals.recentWindows),
      }),
    },
    {
      label: t('usageLogsPage.summary.requests'),
      value: formatNumber(totals.success + totals.failed),
      detail: t('usageLogsPage.summary.requestsDetail', {
        success: formatNumber(totals.success),
        failed: formatNumber(totals.failed),
      }),
    },
    {
      label: t('usageLogsPage.summary.logs'),
      value: formatNumber(snapshot.runtimeLogs?.lineCount ?? 0),
      detail: t('usageLogsPage.summary.logsDetail', {
        count: formatNumber(snapshot.requestErrorLogs.length),
      }),
    },
  ]

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="bg-card rounded-lg border p-4 shadow-sm">
          <p className="text-muted-foreground text-sm">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          <p className="text-muted-foreground mt-1 text-xs">{card.detail}</p>
        </div>
      ))}
    </div>
  )
}

export function ApiKeyUsageTable({
  resources,
  canRead,
}: {
  resources: ApiKeyUsageResource[]
  canRead: boolean
}) {
  const { t } = useTranslation()

  return (
    <TableSurface className="min-w-0 p-4">
      <SectionHeader
        title={t('usageLogsPage.usage.title')}
        description={t('usageLogsPage.usage.description')}
      />
      <div className="isolate mt-3 overflow-hidden rounded-md border">
        {!canRead ? (
          <TableEmptyState
            kind="unsupported"
            className="m-0 border-0"
            title={t('usageLogsPage.usage.unavailableTitle')}
            description={t('usageLogsPage.usage.unavailable')}
          />
        ) : resources.length > 0 ? (
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader className="bg-muted/70 text-muted-foreground">
                <TableRow variant="static">
                  <TableHead>{t('usageLogsPage.usage.provider')}</TableHead>
                  <TableHead>{t('usageLogsPage.usage.baseUrl')}</TableHead>
                  <TableHead>{t('usageLogsPage.usage.key')}</TableHead>
                  <TableHead className="text-right">{t('usageLogsPage.usage.success')}</TableHead>
                  <TableHead className="text-right">{t('usageLogsPage.usage.failed')}</TableHead>
                  <TableHead className="text-right">
                    {t('usageLogsPage.usage.recentWindows')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((resource) => (
                  <TableRow key={resource.id} variant="resource">
                    <TableCell className="font-medium">{resource.provider}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[260px] truncate font-mono text-xs">
                      {resource.baseUrl || t('usageLogsPage.status.notAvailable')}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{resource.apiKeyPreview}</TableCell>
                    <TableCell className="text-right">{formatNumber(resource.success)}</TableCell>
                    <TableCell className="text-right">{formatNumber(resource.failed)}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(resource.recentRequestCount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <TableEmptyState
            kind="empty"
            className="m-0 border-0"
            title={t('usageLogsPage.usage.emptyTitle')}
            description={t('usageLogsPage.usage.empty')}
          />
        )}
      </div>
    </TableSurface>
  )
}

function LogLevelBadge({ level, compact = false }: { level: string | null; compact?: boolean }) {
  const { t } = useTranslation()
  const normalizedLevel = level?.trim().toLowerCase() ?? ''
  const danger = ['error', 'fatal', 'panic'].includes(normalizedLevel)
  const warning = ['warn', 'warning'].includes(normalizedLevel)
  const info = normalizedLevel === 'info'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border font-mono text-xs font-medium uppercase',
        compact ? 'h-5 px-1.5' : 'px-2 py-1',
        danger
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : warning
            ? 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
            : info
              ? 'border-info/30 bg-info/10 text-info'
              : 'border-border bg-muted/50 text-muted-foreground',
      )}
    >
      {level || t('usageLogsPage.status.notAvailable')}
    </span>
  )
}

function RuntimeLogFiltersToolbar({
  filters,
  disabled,
  onChange,
  onClear,
}: {
  filters: RuntimeLogFilters
  disabled: boolean
  onChange: (nextFilters: Partial<RuntimeLogFilters>) => void
  onClear: () => void
}) {
  const { t, i18n } = useTranslation()
  const [searchField, setSearchField] = useState<RuntimeLogSearchField>(() =>
    getActiveRuntimeLogSearchField(filters),
  )
  const active = hasActiveRuntimeLogFilters(filters)
  const searchValue = filters[searchField]
  const searchOptions = runtimeLogSearchFieldOptions.map((field) => ({
    value: field,
    label: t(`usageLogsPage.logs.filters.searchFields.${field}`),
  }))
  const clearSearchFields = {
    homeIp: defaultRuntimeLogFilters.homeIp,
    clientIp: defaultRuntimeLogFilters.clientIp,
    requestId: defaultRuntimeLogFilters.requestId,
  }

  useEffect(() => {
    const activeSearchField = getActiveRuntimeLogSearchField(filters)
    if (filters[activeSearchField].trim()) {
      setSearchField(activeSearchField)
    } else if (!hasActiveRuntimeLogFilters(filters)) {
      setSearchField(defaultRuntimeLogSearchField)
    }
  }, [
    filters.after,
    filters.before,
    filters.clientIp,
    filters.homeIp,
    filters.level,
    filters.requestId,
  ])

  const handleSearchFieldChange = (value: string) => {
    if (!runtimeLogSearchFieldOptions.includes(value as RuntimeLogSearchField)) return
    const nextField = value as RuntimeLogSearchField
    setSearchField(nextField)
    onChange({
      ...clearSearchFields,
      [nextField]: searchValue,
    })
  }

  const handleSearchValueChange = (value: string) => {
    onChange({
      ...clearSearchFields,
      [searchField]: value,
    })
  }

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        <Select
          value={filters.level}
          disabled={disabled}
          onValueChange={(level) => onChange({ level: level as RuntimeLogLevelFilter })}
        >
          <SelectTrigger
            className={cn(usageTouchControlClassName, 'w-full sm:w-40')}
            size="sm"
            aria-label={t('usageLogsPage.logs.filters.level')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {runtimeLogLevelOptions.map((level) => (
              <SelectItem key={level} value={level}>
                {t(`usageLogsPage.logs.filters.levels.${level}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SelectInputGroup
          selectValue={searchField}
          inputValue={searchValue}
          options={searchOptions}
          disabled={disabled}
          selectAriaLabel={t('usageLogsPage.logs.filters.searchBy')}
          inputAriaLabel={t('usageLogsPage.logs.filters.searchPlaceholder', {
            field: t(`usageLogsPage.logs.filters.searchFields.${searchField}`),
          })}
          inputPlaceholder={t('usageLogsPage.logs.filters.searchPlaceholder', {
            field: t(`usageLogsPage.logs.filters.searchFields.${searchField}`),
          })}
          onSelectValueChange={handleSearchFieldChange}
          onInputValueChange={handleSearchValueChange}
        />
        <DateTimeRangePicker
          from={filters.after}
          to={filters.before}
          label={t('usageLogsPage.logs.filters.dateRange')}
          fromLabel={t('usageLogsPage.logs.filters.after')}
          toLabel={t('usageLogsPage.logs.filters.before')}
          separatorLabel={t('usageLogsPage.logs.filters.dateRangeSeparator')}
          placeholder={t('usageLogsPage.logs.filters.dateRangePlaceholder')}
          clearLabel={t('usageLogsPage.logs.filters.clearDateRange')}
          disabled={disabled}
          locale={getDateTimeLocale(i18n)}
          onChange={(range) => onChange({ after: range.from, before: range.to })}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(usageTouchButtonClassName, 'justify-center lg:ml-auto lg:shrink-0')}
        disabled={disabled || !active}
        onClick={() => {
          setSearchField(defaultRuntimeLogSearchField)
          onClear()
        }}
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        {t('usageLogsPage.logs.filters.clear')}
      </Button>
    </div>
  )
}

export function RuntimeLogViewer({
  runtimeLogs,
  canRead,
  canClear,
  fileLoggingEnabled,
  filters,
  pageSizeOptions,
  pageSize,
  offset,
  downloadingRequestLogId,
  isDownloadingRequestLog,
  clearing,
  fetching,
  mutating,
  onClear,
  onFilterChange,
  onClearFilters,
  onPageSizeChange,
  onOffsetChange,
  onDownloadRequestLog,
  liveRefresh,
  liveRefreshIntervalMs,
  liveRefreshError,
  liveRefreshLastSuccessAt,
  pendingItemCount,
  pendingItemsTruncated,
  onAcceptPendingItems,
  onDetailOpenChange,
}: {
  runtimeLogs: RuntimeLogSnapshot | null
  canRead: boolean
  canClear: boolean
  fileLoggingEnabled: boolean
  filters: RuntimeLogFilters
  pageSizeOptions: number[]
  pageSize: number
  offset: number
  downloadingRequestLogId: string | null
  isDownloadingRequestLog: boolean
  clearing: boolean
  fetching: boolean
  mutating: boolean
  onClear: () => void
  onFilterChange: (nextFilters: Partial<RuntimeLogFilters>) => void
  onClearFilters: () => void
  onPageSizeChange: (pageSize: number) => void
  onOffsetChange: (offset: number) => void
  onDownloadRequestLog: (
    requestId: string,
    homeIp?: string | null,
    homePort?: number | null,
  ) => void
  liveRefresh: {
    enabled: boolean
    active: boolean
    pauseReason: LiveRefreshPauseReason | null
    available: boolean
    setEnabled: (enabled: boolean) => void
  }
  liveRefreshIntervalMs: number
  liveRefreshError: boolean
  liveRefreshLastSuccessAt: number | null
  pendingItemCount: number
  pendingItemsTruncated: boolean
  onAcceptPendingItems: () => void
  onDetailOpenChange: (open: boolean) => void
}) {
  const liveRefreshStatusId = 'runtime-log-live-refresh-status'
  const { t, i18n } = useTranslation()
  const [selectedLog, setSelectedLog] = useState<RuntimeLogRecord | null>(null)
  const records = runtimeLogs?.records ?? []
  const total = runtimeLogs?.total ?? runtimeLogs?.lineCount ?? 0
  const effectiveOffset = runtimeLogs?.offset ?? offset
  const effectiveLimit = runtimeLogs?.limit ?? pageSize
  const start = total > 0 && records.length > 0 ? effectiveOffset + 1 : 0
  const end = total > 0 ? Math.min(effectiveOffset + records.length, total) : 0
  const canGoPrevious = canRead && effectiveOffset > 0
  const canGoNext = canRead && effectiveOffset + effectiveLimit < total
  const hasActiveFilters = hasActiveRuntimeLogFilters(filters)

  return (
    <TableSurface className="min-w-0 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeader title={t('usageLogsPage.logs.title')} />
        <div className="flex shrink-0 items-center gap-2">
          <LiveRefreshControl
            enabled={liveRefresh.enabled}
            disabled={!liveRefresh.available}
            describedBy={!liveRefresh.available ? liveRefreshStatusId : undefined}
            onEnabledChange={liveRefresh.setEnabled}
          />
          <Button
            variant="outline"
            size="sm"
            className="lg:shrink-0"
            disabled={!canClear || mutating}
            onClick={onClear}
          >
            {clearing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" aria-hidden="true" />
            )}
            {t('usageLogsPage.actions.clearLogs')}
          </Button>
        </div>
      </div>
      {runtimeLogs?.latestTimestamp ||
      records.length > 0 ||
      liveRefresh.active ||
      (liveRefresh.enabled && liveRefreshLastSuccessAt) ? (
        <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {runtimeLogs?.latestTimestamp ? (
            <span>
              {t('usageLogsPage.logs.latest', {
                time: formatTimestamp(runtimeLogs.latestTimestamp, i18n),
              })}
            </span>
          ) : records.length > 0 ? (
            <span>{t('usageLogsPage.logs.latestUnavailable')}</span>
          ) : null}
          {liveRefresh.active ? (
            <span>
              {t('observabilityRefresh.status.cadence', {
                seconds: Math.round(liveRefreshIntervalMs / 1000),
              })}
            </span>
          ) : null}
          {liveRefresh.enabled && liveRefreshLastSuccessAt ? (
            <span>
              {t('observabilityRefresh.status.lastSuccess', {
                time: new Intl.DateTimeFormat(i18n.language, {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }).format(new Date(liveRefreshLastSuccessAt)),
              })}
            </span>
          ) : null}
        </div>
      ) : null}
      <LiveRefreshStatusNotice
        id={liveRefreshStatusId}
        enabled={liveRefresh.enabled}
        active={liveRefresh.active}
        pauseReason={liveRefresh.pauseReason}
        intervalMs={liveRefreshIntervalMs}
        hasError={liveRefreshError}
        lastSuccessAt={liveRefreshLastSuccessAt}
        showLastSuccess={false}
        className="mt-3"
      />
      {canRead ? (
        <div className="mt-3 border-t pt-3">
          <RuntimeLogFiltersToolbar
            filters={filters}
            disabled={mutating}
            onChange={onFilterChange}
            onClear={onClearFilters}
          />
        </div>
      ) : null}
      <NewItemsNotice
        count={pendingItemCount}
        truncated={pendingItemsTruncated}
        className="mt-3"
        onAccept={onAcceptPendingItems}
      />
      <div className="mt-3 overflow-hidden rounded-md border">
        {!canRead ? (
          <TableEmptyState
            kind={fileLoggingEnabled ? 'unsupported' : 'disabled'}
            className="m-0 border-0"
            title={t(
              fileLoggingEnabled
                ? 'usageLogsPage.logs.unavailableTitle'
                : 'usageLogsPage.logs.fileLoggingDisabledTitle',
            )}
            description={
              fileLoggingEnabled
                ? t('usageLogsPage.logs.unavailable')
                : t('usageLogsPage.logs.fileLoggingDisabled')
            }
          />
        ) : records.length > 0 ? (
          <>
            <Table
              containerClassName={containedTableContainerClassName}
              className="w-full min-w-[900px] table-fixed"
            >
              <TableHeader className={stickyTableHeaderClassName}>
                <TableRow variant="static">
                  <TableHead className="w-[172px]">
                    {t('usageLogsPage.logs.columns.time')}
                  </TableHead>
                  <TableHead className="w-[152px]">
                    {t('usageLogsPage.logs.columns.request')}
                  </TableHead>
                  <TableHead>{t('usageLogsPage.logs.columns.summary')}</TableHead>
                  <TableHead className="table-sticky-action-head w-36 text-right">
                    {t('usageLogsPage.logs.columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <RuntimeLogRow
                    key={record.id}
                    record={record}
                    onInspectLog={(nextRecord) => {
                      setSelectedLog(nextRecord)
                      onDetailOpenChange(true)
                    }}
                  />
                ))}
              </TableBody>
            </Table>
            <RuntimeLogPagination
              pageSizeOptions={pageSizeOptions}
              pageSize={pageSize}
              start={start}
              end={end}
              total={total}
              canGoPrevious={canGoPrevious}
              canGoNext={canGoNext}
              mutating={fetching || mutating}
              onPageSizeChange={onPageSizeChange}
              onPrevious={() => onOffsetChange(Math.max(0, effectiveOffset - effectiveLimit))}
              onNext={() => onOffsetChange(effectiveOffset + effectiveLimit)}
            />
          </>
        ) : runtimeLogs?.lines.length ? (
          <div className="bg-muted/40 max-h-[360px] overflow-auto p-3">
            <pre className="text-foreground font-mono text-xs leading-5 break-words whitespace-pre-wrap">
              {runtimeLogs.lines.join('\n')}
            </pre>
          </div>
        ) : total > 0 && effectiveOffset > 0 ? (
          <TableEmptyState
            kind="filtered-empty"
            className="m-0 border-0"
            title={t('usageLogsPage.logs.emptyPageTitle')}
            description={t('usageLogsPage.logs.emptyPage')}
          />
        ) : hasActiveFilters ? (
          <TableEmptyState
            kind="filtered-empty"
            className="m-0 border-0"
            title={t('usageLogsPage.logs.filteredEmptyTitle')}
            description={t('usageLogsPage.logs.filteredEmpty')}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={usageTouchButtonClassName}
                disabled={mutating}
                onClick={onClearFilters}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {t('usageLogsPage.logs.filters.clear')}
              </Button>
            }
          />
        ) : (
          <TableEmptyState
            kind="empty"
            className="m-0 border-0"
            title={t('usageLogsPage.logs.emptyTitle')}
            description={t('usageLogsPage.logs.empty')}
          />
        )}
      </div>
      <RuntimeLogDetailSheet
        record={selectedLog}
        mutating={mutating}
        downloadingRequestLogId={downloadingRequestLogId}
        isDownloadingRequestLog={isDownloadingRequestLog}
        onOpenChange={(open) => {
          onDetailOpenChange(open)
          if (!open) setSelectedLog(null)
        }}
        onDownloadRequestLog={onDownloadRequestLog}
      />
    </TableSurface>
  )
}

function RuntimeLogPagination({
  pageSizeOptions,
  pageSize,
  start,
  end,
  total,
  canGoPrevious,
  canGoNext,
  mutating,
  onPageSizeChange,
  onPrevious,
  onNext,
}: {
  pageSizeOptions: number[]
  pageSize: number
  start: number
  end: number
  total: number
  canGoPrevious: boolean
  canGoNext: boolean
  mutating: boolean
  onPageSizeChange: (pageSize: number) => void
  onPrevious: () => void
  onNext: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="border-border/80 bg-muted/20 flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <TablePaginationStatus
        text={t('usageLogsPage.logs.pagination.range', {
          start: formatNumber(start),
          end: formatNumber(end),
          total: formatNumber(total),
        })}
        announcementKey={`${start}:${end}:${pageSize}`}
        busy={mutating}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {t('usageLogsPage.logs.pagination.pageSize')}
          </span>
          <Select
            value={String(pageSize)}
            disabled={mutating}
            onValueChange={(nextValue) => onPageSizeChange(Number(nextValue))}
          >
            <SelectTrigger
              className="w-24"
              size="sm"
              aria-label={t('usageLogsPage.logs.pagination.pageSize')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {formatNumber(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGoPrevious || mutating}
            onClick={onPrevious}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {t('usageLogsPage.logs.pagination.previous')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGoNext || mutating}
            onClick={onNext}
          >
            {t('usageLogsPage.logs.pagination.next')}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function RuntimeLogDetailSheet({
  record,
  mutating,
  downloadingRequestLogId,
  isDownloadingRequestLog,
  onOpenChange,
  onDownloadRequestLog,
}: {
  record: RuntimeLogRecord | null
  mutating: boolean
  downloadingRequestLogId: string | null
  isDownloadingRequestLog: boolean
  onOpenChange: (open: boolean) => void
  onDownloadRequestLog: (
    requestId: string,
    homeIp?: string | null,
    homePort?: number | null,
  ) => void
}) {
  const { t, i18n } = useTranslation()
  const downloading =
    isDownloadingRequestLog &&
    Boolean(record?.requestId) &&
    downloadingRequestLogId === record?.requestId

  return (
    <Sheet open={record !== null} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-hidden p-0 focus:outline-hidden sm:max-w-2xl"
        tabIndex={-1}
      >
        <SheetHeader className="border-b p-4">
          <SheetTitle>{t('usageLogsPage.logs.detail.title')}</SheetTitle>
          <SheetDescription>
            {record?.timestamp
              ? (formatDateTime(record.timestamp, i18n) ?? record.timestamp)
              : t('usageLogsPage.status.notAvailable')}
          </SheetDescription>
        </SheetHeader>
        {record ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailField label={t('usageLogsPage.logs.columns.level')}>
                <LogLevelBadge level={getRuntimeLogLevel(record)} />
              </DetailField>
              <DetailField label={t('usageLogsPage.logs.detail.createdAt')}>
                {formatDateTime(record.createdAt, i18n) ?? t('usageLogsPage.status.notAvailable')}
              </DetailField>
              <DetailField label={t('usageLogsPage.logs.columns.request')}>
                {record.requestId ?? t('usageLogsPage.status.unknownRequest')}
              </DetailField>
              <DetailField label={t('usageLogsPage.logs.columns.homeIp')}>
                {formatHomeEndpoint(record.homeIp, record.homePort) ??
                  t('usageLogsPage.status.localHome')}
              </DetailField>
              <DetailField label={t('usageLogsPage.logs.columns.clientIp')}>
                {record.clientIp ?? t('usageLogsPage.status.notAvailable')}
              </DetailField>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium">{t('usageLogsPage.logs.detail.content')}</h3>
              <pre className="bg-muted/45 text-foreground mt-2 max-h-[52vh] min-h-56 overflow-auto rounded-md border p-3 font-mono text-xs leading-5 break-words whitespace-pre-wrap">
                {record.line || t('usageLogsPage.status.notAvailable')}
              </pre>
            </div>
          </div>
        ) : null}
        <div className="bg-popover border-t p-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!record?.requestLogAvailable || mutating}
            onClick={() =>
              record?.requestId &&
              onDownloadRequestLog(record.requestId, record.homeIp, record.homePort)
            }
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            {t('usageLogsPage.actions.downloadRequestLog')}
          </Button>
          {!record?.requestLogAvailable ? (
            <p className="text-muted-foreground mt-2 text-xs">
              {t('usageLogsPage.logs.detail.requestLogUnavailable')}
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function RuntimeLogRow({
  record,
  onInspectLog,
}: {
  record: RuntimeLogRecord
  onInspectLog: (record: RuntimeLogRecord) => void
}) {
  const { t, i18n } = useTranslation()
  const summary = getRuntimeLogSummary(record.line)
  const level = getRuntimeLogLevel(record)

  return (
    <TableRow variant="resource" className="group">
      <TableCell className="text-muted-foreground truncate">
        {formatDateTime(record.timestamp, i18n) ?? t('usageLogsPage.status.notAvailable')}
      </TableCell>
      <TableCell className="text-muted-foreground truncate font-mono text-xs">
        {record.requestId ?? t('usageLogsPage.status.unknownRequest')}
      </TableCell>
      <TableCell className="min-w-0 whitespace-normal">
        <div className="flex w-full min-w-0 items-center gap-2">
          <LogLevelBadge level={level} compact />
          <span className="text-muted-foreground block min-w-0 flex-1 truncate font-mono text-xs">
            {summary ?? t('usageLogsPage.status.notAvailable')}
          </span>
        </div>
      </TableCell>
      <TableCell className="table-sticky-action-cell w-36 text-right transition-colors">
        <div className="table-action-cell-content">
          <Button type="button" variant="text" size="sm" onClick={() => onInspectLog(record)}>
            <Eye className="size-4" aria-hidden="true" />
            {t('usageLogsPage.actions.viewLogDetail')}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function ErrorLogFilesPanel({
  requestErrorLogs,
  canRead,
  loading,
  updatedAt,
  mutating,
  downloadingErrorLogName,
  isDownloadingErrorLog,
  onDownloadErrorLog,
}: {
  requestErrorLogs: RequestErrorLogFile[]
  canRead: boolean
  loading: boolean
  updatedAt: string | null
  mutating: boolean
  downloadingErrorLogName: string | null
  isDownloadingErrorLog: boolean
  onDownloadErrorLog: (fileName: string) => void
}) {
  const { t, i18n } = useTranslation()
  const [search, setSearch] = useState('')
  const rows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return requestErrorLogs
    return requestErrorLogs.filter((log) => log.name.toLowerCase().includes(normalizedSearch))
  }, [requestErrorLogs, search])

  return (
    <TableSurface className="min-w-0 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeader
          title={t('usageLogsPage.errorLogs.title')}
          description={t('usageLogsPage.errorLogs.description')}
        />
        <div className="flex min-w-0 flex-col gap-2 lg:w-80">
          {updatedAt ? (
            <p className="text-muted-foreground text-right text-xs">
              {t('usageLogsPage.header.updatedAt', {
                time: formatDateTime(updatedAt, i18n) ?? updatedAt,
              })}
            </p>
          ) : null}
          <div className="relative min-w-0">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              value={search}
              placeholder={t('usageLogsPage.errorLogs.searchPlaceholder')}
              disabled={!canRead || mutating}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="mt-3 overflow-hidden rounded-md border">
        {loading ? (
          <div className="grid gap-2 p-3" aria-busy="true">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : !canRead ? (
          <TableEmptyState
            kind="unsupported"
            className="m-0 border-0"
            title={t('usageLogsPage.errorLogs.unavailableTitle')}
            description={t('usageLogsPage.errorLogs.unavailable')}
          />
        ) : rows.length > 0 ? (
          <Table
            containerClassName={containedTableContainerClassName}
            className="min-w-[620px] table-fixed"
          >
            <TableHeader className={stickyTableHeaderClassName}>
              <TableRow variant="static">
                <TableHead className="w-[260px]">
                  {t('usageLogsPage.errorLogs.columns.name')}
                </TableHead>
                <TableHead className="w-[160px]">
                  {t('usageLogsPage.errorLogs.columns.modified')}
                </TableHead>
                <TableHead className="w-[80px] text-right">
                  {t('usageLogsPage.errorLogs.columns.size')}
                </TableHead>
                <TableHead className="table-sticky-action-head w-[120px] text-right">
                  {t('usageLogsPage.errorLogs.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const downloading = isDownloadingErrorLog && downloadingErrorLogName === row.name

                return (
                  <TableRow key={row.name} variant="resource" className="group">
                    <TableCell className="truncate font-mono text-xs">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground truncate">
                      {formatTimestamp(row.modified, i18n) ??
                        t('usageLogsPage.status.notAvailable')}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right">
                      {row.size != null
                        ? t('usageLogsPage.requestLogs.sizeBytes', { size: formatBytes(row.size) })
                        : t('usageLogsPage.status.notAvailable')}
                    </TableCell>
                    <TableCell className="table-sticky-action-cell w-[120px] text-right transition-colors">
                      <div className="table-action-cell-content">
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
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <TableEmptyState
            kind="empty"
            className="m-0 border-0"
            title={t('usageLogsPage.errorLogs.emptyTitle')}
            description={t('usageLogsPage.errorLogs.empty')}
          />
        )}
      </div>
    </TableSurface>
  )
}
