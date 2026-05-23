import { type FormEvent, useState } from 'react'

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Download,
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
import { useUsageLogsWorkbench } from '@/features/usage-logs/use-usage-logs-workbench'
import type {
  ApiKeyUsageResource,
  RequestErrorLogFile,
  RuntimeLogSnapshot,
  UsageLogIssue,
  UsageQueueRecord,
} from '@/lib/api/management/usage-logs'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

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

function UsageSummaryCards({
  usage,
  runtimeLogs,
  requestErrorLogs,
}: {
  usage: ApiKeyUsageResource[]
  runtimeLogs: RuntimeLogSnapshot | null
  requestErrorLogs: RequestErrorLogFile[]
}) {
  const { t } = useTranslation()
  const success = usage.reduce((total, item) => total + item.success, 0)
  const failed = usage.reduce((total, item) => total + item.failed, 0)
  const recentWindows = usage.reduce((total, item) => total + item.recentRequestCount, 0)
  const lineCount = runtimeLogs?.lineCount ?? 0
  const cards = [
    {
      id: 'keys',
      label: t('usageLogsPage.summary.keys'),
      value: usage.length,
      detail: t('usageLogsPage.summary.keysDetail', { count: recentWindows }),
    },
    {
      id: 'requests',
      label: t('usageLogsPage.summary.requests'),
      value: success + failed,
      detail: t('usageLogsPage.summary.requestsDetail', { success, failed }),
    },
    {
      id: 'logs',
      label: t('usageLogsPage.summary.logs'),
      value: lineCount,
      detail: t('usageLogsPage.summary.logsDetail', {
        count: requestErrorLogs.length,
      }),
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <div key={card.id} className="bg-card rounded-lg border p-4 shadow-sm">
          <p className="text-muted-foreground text-xs font-medium">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          <p className="text-muted-foreground mt-2 text-xs leading-5">{card.detail}</p>
        </div>
      ))}
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
      <div className="bg-card rounded-lg border p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-normal">
              {t('usageLogsPage.header.title')}
            </h1>
            <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-6">
              {t('usageLogsPage.header.description')}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="self-start lg:self-auto"
            disabled={workbench.isFetching}
            onClick={workbench.refetch}
            aria-label={
              workbench.isFetching
                ? t('usageLogsPage.actions.syncing')
                : t('usageLogsPage.actions.refresh')
            }
            title={
              workbench.isFetching
                ? t('usageLogsPage.actions.syncing')
                : t('usageLogsPage.actions.refresh')
            }
          >
            {workbench.isFetching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            {workbench.isFetching
              ? t('usageLogsPage.actions.syncing')
              : t('usageLogsPage.actions.refresh')}
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
            {t('usageLogsPage.header.updatedAt', {
              time: formatDateTime(workbench.snapshot.fetchedAt),
            })}
          </span>
        </div>
      </div>

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

      <UsageSummaryCards
        usage={workbench.snapshot.apiKeyUsage}
        runtimeLogs={workbench.snapshot.runtimeLogs}
        requestErrorLogs={workbench.snapshot.requestErrorLogs}
      />

      <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t('usageLogsPage.usage.title')}</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            {t('usageLogsPage.usage.description')}
          </p>
        </div>
        <div className="mt-3">
          <ApiKeyUsageTable resources={workbench.snapshot.apiKeyUsage} />
        </div>
      </div>

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

      <div className="grid gap-4">
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
