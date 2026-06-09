import { type ReactNode, useMemo, useState } from 'react'

import type { i18n as I18nInstance } from 'i18next'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import {
  TableSurface,
  containedTableContainerClassName,
  stickyTableHeaderClassName,
} from '@/components/shared/table-surface'
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
import { useUsageLogsWorkbench } from '@/features/usage-logs/use-usage-logs-workbench'
import type { RuntimeMode } from '@/lib/api/management/types'
import type {
  ApiKeyUsageResource,
  RequestErrorLogFile,
  RuntimeLogRecord,
  RuntimeLogSnapshot,
  UsageLogIssue,
  UsageLogsSnapshot,
} from '@/lib/api/management/usage-logs'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type UsageVerdict = 'ready' | 'idle' | 'disabled' | 'partial' | 'limited' | 'unsupported'

function getDateTimeLocale(i18n: I18nInstance) {
  return i18n.resolvedLanguage ?? i18n.language
}

function formatDateTime(value: string | null, i18n: I18nInstance) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(getDateTimeLocale(i18n), {
    dateStyle: 'medium',
    timeStyle: 'short',
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
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

function formatBytes(value: number | null) {
  if (value === null) return null
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
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

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
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
  if (snapshot.issues.length > 0) return 'partial'
  if (!runtimeHasAnyCapability) return 'unsupported'
  if (snapshot.apiKeyUsage.length === 0 && snapshot.runtimeLogs === null) return 'limited'
  if (!snapshot.settings.usageStatisticsEnabled) return 'disabled'
  if (snapshot.apiKeyUsage.length > 0) return 'ready'
  if (snapshot.settings.usageStatisticsEnabled) return 'idle'
  return 'disabled'
}

function UsageLogsDisconnectedState() {
  const { t } = useTranslation()
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)

  return (
    <PageHeader
      title={t('usageLogsPage.disconnected.title')}
      description={t('usageLogsPage.disconnected.description')}
      actions={
        <Button onClick={openConnectionDialog}>{t('usageLogsPage.disconnected.action')}</Button>
      }
    />
  )
}

function UsageLogsLoadingState() {
  return (
    <section className="grid gap-4">
      <div className="bg-card rounded-lg border p-5 shadow-sm">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
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
    <PageHeader
      title={t('usageLogsPage.error.title')}
      description={errorMessage ?? t('usageLogsPage.error.description')}
      actions={
        <Button onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {t('usageLogsPage.error.retry')}
        </Button>
      }
    />
  )
}

function CapabilityBadge({ available, label }: { available: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
        available
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-border bg-muted/50 text-muted-foreground',
      )}
    >
      <CheckCircle2 className="size-3" aria-hidden="true" />
      {label}
    </span>
  )
}

function UsageVerdictHeader({
  snapshot,
  capabilities,
  runtimeMode,
  isFetching,
  onRefresh,
}: {
  snapshot: UsageLogsSnapshot
  capabilities: {
    usage: boolean
    logs: boolean
    requestErrorLogs: boolean
  }
  runtimeMode: RuntimeMode
  isFetching: boolean
  onRefresh: () => void
}) {
  const { t, i18n } = useTranslation()
  const runtimeHasAnyCapability =
    capabilities.usage || capabilities.logs || capabilities.requestErrorLogs
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
          <span>{t('usageLogsPage.header.runtime', { mode: t(`runtimeMode.${runtimeMode}`) })}</span>
          <span>
            {t('usageLogsPage.header.updatedAt', {
              time: formatDateTime(snapshot.fetchedAt, i18n) ?? snapshot.fetchedAt,
            })}
          </span>
        </>
      }
      tags={<UsageCapabilityStrip capabilities={capabilities} />}
      actions={
        <Button variant="outline" disabled={isFetching} onClick={onRefresh}>
          {isFetching ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          {isFetching ? t('usageLogsPage.actions.syncing') : t('usageLogsPage.actions.refresh')}
        </Button>
      }
    />
  )
}

function UsageCapabilityStrip({
  capabilities,
}: {
  capabilities: {
    usage: boolean
    logs: boolean
    requestErrorLogs: boolean
  }
}) {
  const { t } = useTranslation()

  return (
    <>
      <CapabilityBadge
        available={capabilities.usage}
        label={t('usageLogsPage.capabilities.usage')}
      />
      <CapabilityBadge available={capabilities.logs} label={t('usageLogsPage.capabilities.logs')} />
      <CapabilityBadge
        available={capabilities.requestErrorLogs}
        label={t('usageLogsPage.capabilities.requestErrorLogs')}
      />
    </>
  )
}

function SummaryCards({ snapshot }: { snapshot: UsageLogsSnapshot }) {
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

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-w-0">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-muted-foreground mt-1 text-sm leading-6">{description}</p>
    </div>
  )
}

function ApiKeyUsageTable({
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
          <p className="text-muted-foreground px-3 py-8 text-sm">
            {t('usageLogsPage.usage.unavailable')}
          </p>
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
          <p className="text-muted-foreground px-3 py-8 text-sm">
            {t('usageLogsPage.usage.empty')}
          </p>
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

function RuntimeLogViewer({
  runtimeLogs,
  canRead,
  canClear,
  pageSizeOptions,
  pageSize,
  offset,
  downloadingRequestLogId,
  isDownloadingRequestLog,
  clearing,
  mutating,
  onClear,
  onPageSizeChange,
  onOffsetChange,
  onDownloadRequestLog,
}: {
  runtimeLogs: RuntimeLogSnapshot | null
  canRead: boolean
  canClear: boolean
  pageSizeOptions: number[]
  pageSize: number
  offset: number
  downloadingRequestLogId: string | null
  isDownloadingRequestLog: boolean
  clearing: boolean
  mutating: boolean
  onClear: () => void
  onPageSizeChange: (pageSize: number) => void
  onOffsetChange: (offset: number) => void
  onDownloadRequestLog: (requestId: string, homeIp?: string | null) => void
}) {
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
  const pagination = (
    <RuntimeLogPagination
      pageSizeOptions={pageSizeOptions}
      pageSize={pageSize}
      start={start}
      end={end}
      total={total}
      canGoPrevious={canGoPrevious}
      canGoNext={canGoNext}
      mutating={mutating}
      onPageSizeChange={onPageSizeChange}
      onPrevious={() => onOffsetChange(Math.max(0, effectiveOffset - effectiveLimit))}
      onNext={() => onOffsetChange(effectiveOffset + effectiveLimit)}
    />
  )

  return (
    <TableSurface className="min-w-0 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeader
          title={t('usageLogsPage.logs.title')}
          description={t('usageLogsPage.logs.description')}
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
      <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>
          {t('usageLogsPage.logs.lineCount', {
            count: formatNumber(runtimeLogs?.lineCount ?? 0),
          })}
        </span>
        <span>
          {runtimeLogs?.latestTimestamp
            ? t('usageLogsPage.logs.latest', {
                time: formatTimestamp(runtimeLogs.latestTimestamp, i18n),
              })
            : t('usageLogsPage.logs.latestUnavailable')}
        </span>
        <span>
          {t('usageLogsPage.logs.range', {
            start: formatNumber(start),
            end: formatNumber(end),
            total: formatNumber(total),
          })}
        </span>
      </div>
      <div className="mt-3 overflow-hidden rounded-md border">
        {!canRead ? (
          <p className="text-muted-foreground px-3 py-8 text-sm">
            {t('usageLogsPage.logs.unavailable')}
          </p>
        ) : records.length > 0 ? (
          <>
            <div className="relative">
              <Table
                containerClassName={containedTableContainerClassName}
                className="w-full min-w-[760px] table-fixed"
              >
                <TableHeader className={stickyTableHeaderClassName}>
                  <TableRow variant="static">
                    <TableHead className="w-[172px]">
                      {t('usageLogsPage.logs.columns.time')}
                    </TableHead>
                    <TableHead>{t('usageLogsPage.logs.columns.summary')}</TableHead>
                    <TableHead className="table-sticky-action-head w-36 text-right">
                      {t('usageLogsPage.logs.columns.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <RuntimeLogRow key={record.id} record={record} onInspectLog={setSelectedLog} />
                  ))}
                </TableBody>
              </Table>
            </div>
            {pagination}
          </>
        ) : runtimeLogs?.lines.length ? (
          <>
            <div className="bg-muted/40 max-h-[360px] overflow-auto p-3">
              <pre className="text-foreground font-mono text-xs leading-5 break-words whitespace-pre-wrap">
                {runtimeLogs.lines.join('\n')}
              </pre>
            </div>
            {pagination}
          </>
        ) : total > 0 && effectiveOffset > 0 ? (
          <>
            <p className="text-muted-foreground px-3 py-8 text-sm">
              {t('usageLogsPage.logs.emptyPage')}
            </p>
            {pagination}
          </>
        ) : (
          <p className="text-muted-foreground px-3 py-8 text-sm">{t('usageLogsPage.logs.empty')}</p>
        )}
      </div>
      <RuntimeLogDetailSheet
        record={selectedLog}
        mutating={mutating}
        downloadingRequestLogId={downloadingRequestLogId}
        isDownloadingRequestLog={isDownloadingRequestLog}
        onOpenChange={(open) => {
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
      <p className="text-muted-foreground text-sm">
        {t('usageLogsPage.logs.pagination.range', {
          start: formatNumber(start),
          end: formatNumber(end),
          total: formatNumber(total),
        })}
      </p>
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
            <SelectTrigger className="w-24" size="sm">
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
  onDownloadRequestLog: (requestId: string, homeIp?: string | null) => void
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
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          window.requestAnimationFrame(() => {
            const content = document.querySelector<HTMLElement>('[data-slot="sheet-content"]')
            content?.focus({ preventScroll: true })
          })
        }}
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
              <RuntimeLogMetadata label={t('usageLogsPage.logs.columns.level')}>
                <LogLevelBadge level={getRuntimeLogLevel(record)} />
              </RuntimeLogMetadata>
              <RuntimeLogMetadata label={t('usageLogsPage.logs.detail.createdAt')}>
                {formatDateTime(record.createdAt, i18n) ?? t('usageLogsPage.status.notAvailable')}
              </RuntimeLogMetadata>
              <RuntimeLogMetadata label={t('usageLogsPage.logs.columns.request')}>
                {record.requestId ?? t('usageLogsPage.status.unknownRequest')}
              </RuntimeLogMetadata>
              <RuntimeLogMetadata label={t('usageLogsPage.logs.columns.homeIp')}>
                {record.homeIp ?? t('usageLogsPage.status.localHome')}
              </RuntimeLogMetadata>
              <RuntimeLogMetadata label={t('usageLogsPage.logs.columns.clientIp')}>
                {record.clientIp ?? t('usageLogsPage.status.notAvailable')}
              </RuntimeLogMetadata>
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
              record?.requestId && onDownloadRequestLog(record.requestId, record.homeIp)
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

function RuntimeLogMetadata({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-1 truncate font-mono text-xs">{children}</div>
    </div>
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
        <div className="relative min-w-0 lg:w-80">
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
      <div className="mt-3 overflow-hidden rounded-md border">
        {!canRead ? (
          <p className="text-muted-foreground px-3 py-8 text-sm">
            {t('usageLogsPage.errorLogs.unavailable')}
          </p>
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
                      {formatBytes(row.size) ?? t('usageLogsPage.status.notAvailable')}
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
          <p className="text-muted-foreground px-3 py-8 text-sm">
            {t('usageLogsPage.errorLogs.empty')}
          </p>
        )}
      </div>
    </TableSurface>
  )
}

export function UsageLogsWorkbenchPage() {
  const { t } = useTranslation()
  const workbench = useUsageLogsWorkbench()
  const [clearLogsDialogOpen, setClearLogsDialogOpen] = useState(false)
  const capabilities = workbench.capabilities
  const noRuntimeLogCapabilities =
    !capabilities.usage && !capabilities.logs && !capabilities.requestErrorLogs

  if (!workbench.connected) {
    return <UsageLogsDisconnectedState />
  }

  if (!workbench.capabilityReady || workbench.isPending) {
    return <UsageLogsLoadingState />
  }

  if (workbench.isError || !workbench.snapshot) {
    return <UsageLogsErrorState errorMessage={workbench.errorMessage} onRetry={workbench.refetch} />
  }

  const handleClearLogs = async () => {
    try {
      await workbench.clearLogs()
      setClearLogsDialogOpen(false)
      toast.success(t('usageLogsPage.toast.logsCleared'))
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

  const handleDownloadRequestLog = async (requestId: string, homeIp?: string | null) => {
    try {
      const result = await workbench.downloadRequestLogById({ requestId, homeIp })
      downloadBlob(result.blob, result.fileName)
      toast.success(t('usageLogsPage.toast.logDownloaded'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section className="grid w-full gap-4">
      <UsageVerdictHeader
        snapshot={workbench.snapshot}
        capabilities={capabilities}
        runtimeMode={workbench.runtimeMode}
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
      <SummaryCards snapshot={workbench.snapshot} />

      <ApiKeyUsageTable resources={workbench.snapshot.apiKeyUsage} canRead={capabilities.usage} />

      <div className="grid gap-4">
        <div className="min-w-0">
          <SectionHeader
            title={t('usageLogsPage.operations.title')}
            description={t('usageLogsPage.operations.description')}
          />
        </div>
        <RuntimeLogViewer
          runtimeLogs={workbench.snapshot.runtimeLogs}
          canRead={capabilities.logs}
          canClear={capabilities.logs}
          pageSizeOptions={workbench.runtimeLogPageSizeOptions}
          pageSize={workbench.runtimeLogLimit}
          offset={workbench.runtimeLogOffset}
          downloadingRequestLogId={workbench.downloadingRequestLogId}
          isDownloadingRequestLog={workbench.isDownloadingRequestLog}
          clearing={workbench.isClearingLogs}
          mutating={workbench.mutating}
          onClear={() => setClearLogsDialogOpen(true)}
          onPageSizeChange={workbench.setRuntimeLogLimit}
          onOffsetChange={workbench.setRuntimeLogOffset}
          onDownloadRequestLog={(requestId, homeIp) =>
            void handleDownloadRequestLog(requestId, homeIp)
          }
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
