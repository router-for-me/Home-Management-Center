import { useMemo, useState } from 'react'

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSearch,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import { useUsageLogsWorkbench } from '@/features/usage-logs/use-usage-logs-workbench'
import type { RuntimeMode } from '@/lib/api/management/types'
import type {
  ApiKeyUsageResource,
  RequestErrorLogFile,
  RuntimeLogRecord,
  RuntimeLogSnapshot,
  UsageLogIssue,
  UsageLogsSnapshot,
  UsageQueueRecord,
} from '@/lib/api/management/usage-logs'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type UsageVerdict = 'ready' | 'idle' | 'disabled' | 'partial' | 'limited' | 'unsupported'

function formatDateTime(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatTimestamp(value: number | null) {
  if (value === null) return null
  const date = new Date(value < 1_000_000_000_000 ? value * 1000 : value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat(undefined, {
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
    <section className="bg-card rounded-lg border p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{t('usageLogsPage.disconnected.title')}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
            {t('usageLogsPage.disconnected.description')}
          </p>
        </div>
        <Button className="sm:shrink-0" onClick={openConnectionDialog}>
          {t('usageLogsPage.disconnected.action')}
        </Button>
      </div>
    </section>
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
    <section className="bg-card rounded-lg border p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{t('usageLogsPage.error.title')}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
            {errorMessage ?? t('usageLogsPage.error.description')}
          </p>
        </div>
        <Button className="sm:shrink-0" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {t('usageLogsPage.error.retry')}
        </Button>
      </div>
    </section>
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
    usageQueue: boolean
    logs: boolean
    requestErrorLogs: boolean
  }
  runtimeMode: RuntimeMode
  isFetching: boolean
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const runtimeHasAnyCapability =
    capabilities.usage ||
    capabilities.usageQueue ||
    capabilities.logs ||
    capabilities.requestErrorLogs
  const verdict = getUsageVerdict(snapshot, runtimeHasAnyCapability)

  return (
    <header className="bg-card rounded-lg border p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{t(`usageLogsPage.verdict.${verdict}.title`)}</h1>
            <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium">
              {t(`usageLogsPage.verdict.${verdict}.badge`)}
            </span>
          </div>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
            {t(`usageLogsPage.verdict.${verdict}.description`, {
              mode: t(`runtimeMode.${runtimeMode}`),
            })}
          </p>
          <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span>
              {t('usageLogsPage.header.runtime', { mode: t(`runtimeMode.${runtimeMode}`) })}
            </span>
            <span>
              {t('usageLogsPage.header.updatedAt', {
                time: formatDateTime(snapshot.fetchedAt) ?? snapshot.fetchedAt,
              })}
            </span>
          </div>
        </div>
        <Button variant="outline" className="lg:shrink-0" disabled={isFetching} onClick={onRefresh}>
          {isFetching ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          {isFetching ? t('usageLogsPage.actions.syncing') : t('usageLogsPage.actions.refresh')}
        </Button>
      </div>
    </header>
  )
}

function UsageCapabilityStrip({
  capabilities,
}: {
  capabilities: {
    usage: boolean
    usageQueue: boolean
    logs: boolean
    requestErrorLogs: boolean
  }
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap gap-2">
      <CapabilityBadge
        available={capabilities.usage}
        label={t('usageLogsPage.capabilities.usage')}
      />
      <CapabilityBadge
        available={capabilities.usageQueue}
        label={t('usageLogsPage.capabilities.usageQueue')}
      />
      <CapabilityBadge available={capabilities.logs} label={t('usageLogsPage.capabilities.logs')} />
      <CapabilityBadge
        available={capabilities.requestErrorLogs}
        label={t('usageLogsPage.capabilities.requestErrorLogs')}
      />
    </div>
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
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <SectionHeader
        title={t('usageLogsPage.usage.title')}
        description={t('usageLogsPage.usage.description')}
      />
      <div className="mt-3 overflow-hidden rounded-md border">
        {!canRead ? (
          <p className="text-muted-foreground px-3 py-8 text-sm">
            {t('usageLogsPage.usage.unavailable')}
          </p>
        ) : resources.length > 0 ? (
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader className="bg-muted/70 text-muted-foreground">
                <TableRow className="hover:bg-transparent">
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
                  <TableRow key={resource.id}>
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
    </div>
  )
}

function StatusBadge({ failed }: { failed: boolean | null }) {
  const { t } = useTranslation()
  const label =
    failed === null
      ? t('usageLogsPage.status.unknownRequest')
      : failed
        ? t('usageLogsPage.status.failed')
        : t('usageLogsPage.status.success')

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
        failed === null
          ? 'border-border bg-muted/50 text-muted-foreground'
          : failed
            ? 'border-destructive/30 bg-destructive/10 text-destructive'
            : 'border-success/30 bg-success/10 text-success',
      )}
    >
      {label}
    </span>
  )
}

function LogLevelBadge({ level }: { level: string | null }) {
  const { t } = useTranslation()
  const normalizedLevel = level?.trim().toLowerCase() ?? ''
  const danger = ['error', 'fatal', 'panic'].includes(normalizedLevel)
  const warning = ['warn', 'warning'].includes(normalizedLevel)

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 font-mono text-xs font-medium',
        danger
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : warning
            ? 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
            : 'border-border bg-muted/50 text-muted-foreground',
      )}
    >
      {level || t('usageLogsPage.status.notAvailable')}
    </span>
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
  onDownloadRequestLog: (requestId: string, homeIp?: string | null) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeader
          title={t('usageLogsPage.queue.title')}
          description={t('usageLogsPage.queue.description')}
        />
        <Button
          variant="outline"
          size="sm"
          className="lg:shrink-0"
          disabled={!canRead || mutating}
          onClick={onFetch}
        >
          {fetching ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileSearch className="size-4" aria-hidden="true" />
          )}
          {t('usageLogsPage.actions.fetchQueue')}
        </Button>
      </div>
      {canRead ? (
        <div className="border-info/25 bg-info/8 text-info-foreground mt-3 rounded-md border px-3 py-2 text-sm">
          {t('usageLogsPage.queue.consumes')}
        </div>
      ) : null}
      <div className="mt-3 overflow-hidden rounded-md border">
        {!canRead ? (
          <p className="text-muted-foreground px-3 py-8 text-sm">
            {t('usageLogsPage.queue.unavailable')}
          </p>
        ) : !loaded ? (
          <p className="text-muted-foreground px-3 py-8 text-sm">
            {t('usageLogsPage.queue.notLoaded')}
          </p>
        ) : records.length > 0 ? (
          <div className="overflow-x-auto">
            <Table className="min-w-[980px] table-fixed">
              <TableHeader className="bg-muted/70 text-muted-foreground">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[220px]">
                    {t('usageLogsPage.queue.columns.request')}
                  </TableHead>
                  <TableHead className="w-[150px]">
                    {t('usageLogsPage.queue.columns.homeIp')}
                  </TableHead>
                  <TableHead className="w-[240px]">
                    {t('usageLogsPage.queue.columns.model')}
                  </TableHead>
                  <TableHead className="w-[170px]">
                    {t('usageLogsPage.queue.columns.endpoint')}
                  </TableHead>
                  <TableHead className="w-[90px]">
                    {t('usageLogsPage.queue.columns.status')}
                  </TableHead>
                  <TableHead className="bg-muted sticky right-0 z-10 w-[140px] text-right">
                    {t('usageLogsPage.queue.columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const requestId = record.requestId
                  const downloading =
                    isDownloadingRequestLog &&
                    requestId !== null &&
                    downloadingRequestLogId === requestId

                  return (
                    <TableRow key={record.id} className="group">
                      <TableCell className="truncate font-mono text-xs">
                        {requestId ?? t('usageLogsPage.status.unknownRequest')}
                      </TableCell>
                      <TableCell className="text-muted-foreground truncate font-mono text-xs">
                        {record.homeIp ?? t('usageLogsPage.status.localHome')}
                      </TableCell>
                      <TableCell className="text-muted-foreground truncate">
                        {record.model ?? t('usageLogsPage.status.notAvailable')}
                      </TableCell>
                      <TableCell className="text-muted-foreground truncate">
                        {record.endpoint ?? t('usageLogsPage.status.notAvailable')}
                      </TableCell>
                      <TableCell>
                        <StatusBadge failed={record.failed} />
                      </TableCell>
                      <TableCell className="group-hover:bg-accent bg-card sticky right-0 z-10 w-[140px] text-right transition-colors">
                        <Button
                          type="button"
                          variant="text"
                          size="sm"
                          disabled={!canDownloadRequestLog || !requestId || mutating}
                          onClick={() =>
                            requestId && onDownloadRequestLog(requestId, record.homeIp)
                          }
                        >
                          {downloading ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Download className="size-4" aria-hidden="true" />
                          )}
                          {t('usageLogsPage.actions.downloadRequestLog')}
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
            {t('usageLogsPage.queue.empty')}
          </p>
        )}
      </div>
    </div>
  )
}

function RuntimeLogViewer({
  runtimeLogs,
  canRead,
  canClear,
  downloadingRequestLogId,
  isDownloadingRequestLog,
  clearing,
  mutating,
  onClear,
  onDownloadRequestLog,
}: {
  runtimeLogs: RuntimeLogSnapshot | null
  canRead: boolean
  canClear: boolean
  downloadingRequestLogId: string | null
  isDownloadingRequestLog: boolean
  clearing: boolean
  mutating: boolean
  onClear: () => void
  onDownloadRequestLog: (requestId: string, homeIp?: string | null) => void
}) {
  const { t } = useTranslation()
  const records = runtimeLogs?.records ?? []

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
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
                time: formatTimestamp(runtimeLogs.latestTimestamp),
              })
            : t('usageLogsPage.logs.latestUnavailable')}
        </span>
        {runtimeLogs?.total !== null && runtimeLogs?.total !== undefined ? (
          <span>{t('usageLogsPage.logs.total', { count: formatNumber(runtimeLogs.total) })}</span>
        ) : null}
      </div>
      <div className="mt-3 overflow-hidden rounded-md border">
        {!canRead ? (
          <p className="text-muted-foreground px-3 py-8 text-sm">
            {t('usageLogsPage.logs.unavailable')}
          </p>
        ) : records.length > 0 ? (
          <div className="overflow-x-auto">
            <Table className="min-w-[1120px] table-fixed">
              <TableHeader className="bg-muted/70 text-muted-foreground">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[160px]">
                    {t('usageLogsPage.logs.columns.time')}
                  </TableHead>
                  <TableHead className="w-[110px]">
                    {t('usageLogsPage.logs.columns.level')}
                  </TableHead>
                  <TableHead className="w-[220px]">
                    {t('usageLogsPage.logs.columns.request')}
                  </TableHead>
                  <TableHead className="w-[150px]">
                    {t('usageLogsPage.logs.columns.homeIp')}
                  </TableHead>
                  <TableHead className="w-[140px]">
                    {t('usageLogsPage.logs.columns.clientIp')}
                  </TableHead>
                  <TableHead>{t('usageLogsPage.logs.columns.line')}</TableHead>
                  <TableHead className="bg-muted sticky right-0 z-10 w-[150px] text-right">
                    {t('usageLogsPage.logs.columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <RuntimeLogRow
                    key={record.id}
                    record={record}
                    mutating={mutating}
                    downloadingRequestLogId={downloadingRequestLogId}
                    isDownloadingRequestLog={isDownloadingRequestLog}
                    onDownloadRequestLog={onDownloadRequestLog}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : runtimeLogs?.lines.length ? (
          <div className="bg-muted/40 max-h-[360px] overflow-auto p-3">
            <pre className="text-foreground font-mono text-xs leading-5 break-words whitespace-pre-wrap">
              {runtimeLogs.lines.join('\n')}
            </pre>
          </div>
        ) : (
          <p className="text-muted-foreground px-3 py-8 text-sm">{t('usageLogsPage.logs.empty')}</p>
        )}
      </div>
    </div>
  )
}

function RuntimeLogRow({
  record,
  mutating,
  downloadingRequestLogId,
  isDownloadingRequestLog,
  onDownloadRequestLog,
}: {
  record: RuntimeLogRecord
  mutating: boolean
  downloadingRequestLogId: string | null
  isDownloadingRequestLog: boolean
  onDownloadRequestLog: (requestId: string, homeIp?: string | null) => void
}) {
  const { t } = useTranslation()
  const downloading =
    isDownloadingRequestLog &&
    record.requestId !== null &&
    downloadingRequestLogId === record.requestId

  return (
    <TableRow className="group">
      <TableCell className="text-muted-foreground truncate">
        {formatDateTime(record.timestamp) ?? t('usageLogsPage.status.notAvailable')}
      </TableCell>
      <TableCell>
        <LogLevelBadge level={record.level} />
      </TableCell>
      <TableCell className="truncate font-mono text-xs">
        {record.requestId ?? t('usageLogsPage.status.unknownRequest')}
      </TableCell>
      <TableCell className="text-muted-foreground truncate font-mono text-xs">
        {record.homeIp ?? t('usageLogsPage.status.localHome')}
      </TableCell>
      <TableCell className="text-muted-foreground truncate font-mono text-xs">
        {record.clientIp ?? t('usageLogsPage.status.notAvailable')}
      </TableCell>
      <TableCell className="text-muted-foreground truncate font-mono text-xs">
        {record.line || t('usageLogsPage.status.notAvailable')}
      </TableCell>
      <TableCell className="group-hover:bg-accent bg-card sticky right-0 z-10 text-right transition-colors">
        <Button
          type="button"
          variant="text"
          size="sm"
          disabled={!record.requestId || mutating}
          onClick={() => record.requestId && onDownloadRequestLog(record.requestId, record.homeIp)}
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          {t('usageLogsPage.actions.downloadRequestLog')}
        </Button>
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
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const rows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return requestErrorLogs
    return requestErrorLogs.filter((log) => log.name.toLowerCase().includes(normalizedSearch))
  }, [requestErrorLogs, search])

  return (
    <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
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
          <div className="overflow-x-auto">
            <Table className="min-w-[620px] table-fixed">
              <TableHeader className="bg-muted/70 text-muted-foreground">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[260px]">
                    {t('usageLogsPage.errorLogs.columns.name')}
                  </TableHead>
                  <TableHead className="w-[160px]">
                    {t('usageLogsPage.errorLogs.columns.modified')}
                  </TableHead>
                  <TableHead className="w-[80px] text-right">
                    {t('usageLogsPage.errorLogs.columns.size')}
                  </TableHead>
                  <TableHead className="bg-muted sticky right-0 z-10 w-[120px] text-right">
                    {t('usageLogsPage.errorLogs.columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const downloading = isDownloadingErrorLog && downloadingErrorLogName === row.name

                  return (
                    <TableRow key={row.name} className="group">
                      <TableCell className="truncate font-mono text-xs">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground truncate">
                        {formatTimestamp(row.modified) ?? t('usageLogsPage.status.notAvailable')}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right">
                        {formatBytes(row.size) ?? t('usageLogsPage.status.notAvailable')}
                      </TableCell>
                      <TableCell className="group-hover:bg-accent bg-card sticky right-0 z-10 text-right transition-colors">
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

export function UsageLogsWorkbenchPage() {
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

      <UsageCapabilityStrip capabilities={capabilities} />

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
        <UsageQueuePanel
          records={workbench.usageQueueRecords}
          loaded={workbench.usageQueueLoaded}
          canRead={capabilities.usageQueue}
          canDownloadRequestLog={capabilities.logs}
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
          downloadingRequestLogId={workbench.downloadingRequestLogId}
          isDownloadingRequestLog={workbench.isDownloadingRequestLog}
          clearing={workbench.isClearingLogs}
          mutating={workbench.mutating}
          onClear={() => setClearLogsDialogOpen(true)}
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
