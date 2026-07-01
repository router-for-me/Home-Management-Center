import { type FormEvent, useState } from 'react'

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Info,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  ServerCog,
  TerminalSquare,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { TableEmptyState } from '@/components/shared/empty-state'
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
import { Textarea } from '@/components/ui/textarea'
import {
  type SystemNodesOperationalLevel,
  type SystemNodesOperationalStatus,
  useSystemNodesWorkbench,
} from '@/features/system-nodes/use-system-nodes-workbench'
import type {
  ApiCallInput,
  ApiCallResult,
  CertificateClientEnrollment,
  SystemConfigSummary,
  SystemIssue,
  SystemNodeResource,
} from '@/lib/api/management/system-nodes'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

const defaultApiCallInput: ApiCallInput = {
  method: 'GET',
  url: '',
  authIndex: '',
  headers: '{}',
  data: '',
}

type StatusTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

const statusToneStyles: Record<StatusTone, string> = {
  success: 'border-success/30 bg-success/10 text-success',
  info: 'border-info/30 bg-info/10 text-info',
  warning: 'border-warning/35 bg-warning/12 text-warning',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
}

const operationalLevelStyles: Record<
  SystemNodesOperationalLevel,
  {
    icon: string
    badge: string
  }
> = {
  ready: {
    icon: 'border-success/30 bg-success/10 text-success',
    badge: 'border-success/30 bg-success/10 text-success',
  },
  limited: {
    icon: 'border-info/30 bg-info/10 text-info',
    badge: 'border-info/30 bg-info/10 text-info',
  },
  degraded: {
    icon: 'border-warning/35 bg-warning/12 text-warning',
    badge: 'border-warning/35 bg-warning/12 text-warning',
  },
  unavailable: {
    icon: 'border-destructive/30 bg-destructive/10 text-destructive',
    badge: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
}

function getOperationalIcon(level: SystemNodesOperationalLevel) {
  if (level === 'ready') return CheckCircle2
  if (level === 'limited') return Info
  return AlertTriangle
}

function getStatusIcon(tone: StatusTone) {
  if (tone === 'success') return CheckCircle2
  if (tone === 'info') return Info
  if (tone === 'warning' || tone === 'danger') return AlertTriangle
  return ServerCog
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = value
  textArea.setAttribute('readonly', 'true')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.append(textArea)
  textArea.select()
  document.execCommand('copy')
  textArea.remove()
}

function formatDateTime(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function SystemNodesDisconnectedState() {
  const { t } = useTranslation()
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-md">
              <ServerCog className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">
                {t('systemNodesPage.disconnected.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {t('systemNodesPage.disconnected.description')}
              </p>
            </div>
          </div>
          <Button className="md:shrink-0" onClick={openConnectionDialog}>
            <ServerCog className="size-4" aria-hidden="true" />
            {t('systemNodesPage.disconnected.action')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function SystemNodesLoadingState() {
  return (
    <section className="grid gap-4">
      <Skeleton className="h-32 rounded-lg" />
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    </section>
  )
}

function SystemNodesErrorState({
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
                {t('systemNodesPage.error.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {errorMessage ?? t('systemNodesPage.error.description')}
              </p>
            </div>
          </div>
          <Button variant="outline" className="md:shrink-0" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {t('systemNodesPage.error.retry')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function SummaryCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: string
  detail: string
  tone?: StatusTone
}) {
  const Icon = getStatusIcon(tone)

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p className="mt-2 truncate text-xl font-semibold">{value}</p>
        </div>
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md border',
            statusToneStyles[tone],
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>
      <p className="text-muted-foreground mt-2 text-xs leading-5">{detail}</p>
    </div>
  )
}

function OperationalVerdictPanel({
  status,
  runtimeLabel,
  probedAt,
  fetchedAt,
  isFetching,
  onRefresh,
  onOpenDiagnostics,
}: {
  status: SystemNodesOperationalStatus
  runtimeLabel: string
  probedAt: string | null
  fetchedAt: string | null
  isFetching: boolean
  onRefresh: () => void
  onOpenDiagnostics: () => void
}) {
  const { t } = useTranslation()
  const Icon = getOperationalIcon(status.level)
  const styles = operationalLevelStyles[status.level]

  const facts = [
    {
      label: t('systemNodesPage.verdict.facts.config', {
        status: status.configAvailable
          ? t('systemNodesPage.status.available')
          : t('systemNodesPage.status.notAvailable'),
      }),
      tone: status.configAvailable ? 'success' : 'warning',
    },
    {
      label: t('systemNodesPage.verdict.facts.version', {
        status: status.latestVersionAvailable
          ? t('systemNodesPage.status.available')
          : t('systemNodesPage.status.notAvailable'),
      }),
      tone: status.latestVersionAvailable ? 'success' : 'warning',
    },
    {
      label: status.nodesSupported
        ? t('systemNodesPage.verdict.facts.nodes', { count: status.nodeCount })
        : t('systemNodesPage.verdict.facts.nodesUnsupported'),
      tone: status.nodesSupported ? (status.nodeCount > 0 ? 'success' : 'neutral') : 'info',
    },
    {
      label:
        status.issueCount > 0
          ? t('systemNodesPage.verdict.facts.issues', { count: status.issueCount })
          : t('systemNodesPage.verdict.facts.noIssues'),
      tone: status.issueCount > 0 ? 'warning' : 'success',
    },
  ] satisfies Array<{ label: string; tone: StatusTone }>

  return (
    <div className="bg-card rounded-lg border p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-md border',
              styles.icon,
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-normal">
                {t(`systemNodesPage.verdict.${status.level}.title`)}
              </h1>
              <span
                className={cn('rounded-md border px-2.5 py-1 text-xs font-medium', styles.badge)}
              >
                {t(`systemNodesPage.verdict.${status.level}.badge`)}
              </span>
            </div>
            <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
              {t(`systemNodesPage.verdict.${status.level}.description`)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs font-medium">
                {t('systemNodesPage.header.runtime', {
                  mode: runtimeLabel,
                })}
              </span>
              <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
                {t('systemNodesPage.header.probedAt', {
                  time: probedAt ?? t('systemNodesPage.status.notAvailable'),
                })}
              </span>
              <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
                {t('systemNodesPage.header.updatedAt', {
                  time: fetchedAt ?? t('systemNodesPage.status.notAvailable'),
                })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={onRefresh}
            aria-label={
              isFetching
                ? t('systemNodesPage.actions.syncing')
                : t('systemNodesPage.actions.refresh')
            }
            title={
              isFetching
                ? t('systemNodesPage.actions.syncing')
                : t('systemNodesPage.actions.refresh')
            }
          >
            {isFetching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            {isFetching
              ? t('systemNodesPage.actions.syncing')
              : t('systemNodesPage.actions.refresh')}
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenDiagnostics}>
            <TerminalSquare className="size-4" aria-hidden="true" />
            {t('systemNodesPage.actions.openDiagnostics')}
          </Button>
        </div>
      </div>

      <div className="border-border/70 mt-5 grid gap-2 border-t pt-4 sm:grid-cols-2 xl:grid-cols-4">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className={cn(
              'rounded-md border px-3 py-2 text-xs font-medium',
              statusToneStyles[fact.tone],
            )}
          >
            {fact.label}
          </div>
        ))}
      </div>
    </div>
  )
}

function ConfigSummaryPanel({ config }: { config: SystemConfigSummary | null }) {
  const { t } = useTranslation()

  if (!config) {
    return (
      <TableEmptyState kind="empty" className="m-0" title={t('systemNodesPage.config.empty')} />
    )
  }

  const rows = [
    ['debug', config.debug],
    ['requestLog', config.requestLog],
    ['usageStatistics', config.usageStatistics],
    ['loggingToFile', config.loggingToFile],
    ['proxyConfigured', config.proxyConfigured],
  ] as const

  return (
    <div className="grid gap-2">
      {rows.map(([key, enabled]) => (
        <div
          key={key}
          className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
        >
          <span className="text-sm">{t(`systemNodesPage.config.fields.${key}`)}</span>
          <span
            className={cn(
              'rounded-md border px-2 py-1 text-xs font-medium',
              enabled
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {enabled ? t('systemNodesPage.status.enabled') : t('systemNodesPage.status.disabled')}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <span className="text-sm">{t('systemNodesPage.config.fields.routingStrategy')}</span>
        <span className="bg-muted text-muted-foreground rounded-md border px-2 py-1 text-xs">
          {t(`configPage.routingStrategies.${config.routingStrategy}`, {
            defaultValue:
              config.routingStrategy === 'unknown'
                ? t('systemNodesPage.status.unknown')
                : config.routingStrategy,
          })}
        </span>
      </div>
    </div>
  )
}

function NodesPanel({
  nodes,
  available,
  runtimeLabel,
}: {
  nodes: SystemNodeResource[]
  available: boolean
  runtimeLabel: string
}) {
  const { t } = useTranslation()

  if (!available) {
    return (
      <TableEmptyState
        kind="unsupported"
        className="m-0"
        title={t('systemNodesPage.nodes.unavailable', {
          runtime: runtimeLabel,
        })}
      />
    )
  }

  if (nodes.length === 0) {
    return (
      <TableEmptyState
        kind="empty"
        className="m-0"
        title={t('systemNodesPage.nodes.emptySupported')}
      />
    )
  }

  return (
    <div className="grid gap-2">
      {nodes.map((node) => (
        <div key={node.id} className="rounded-md border px-3 py-2.5">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="truncate font-mono text-sm">{node.ip}</p>
            <span className="border-primary/30 bg-primary/10 text-primary rounded-md border px-2 py-1 text-xs font-medium">
              {t('systemNodesPage.status.connected')}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {t('systemNodesPage.nodes.connectedTime', {
              time: formatDateTime(node.connectedTime) ?? t('systemNodesPage.status.notAvailable'),
            })}
          </p>
        </div>
      ))}
    </div>
  )
}

function ApiCallSheet({
  open,
  onOpenChange,
  pending,
  result,
  error,
  onRun,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  result: ApiCallResult | undefined
  error: string | null
  onRun: (input: ApiCallInput) => Promise<void>
}) {
  const { t } = useTranslation()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-5">
          <SheetTitle>{t('systemNodesPage.apiCall.title')}</SheetTitle>
          <SheetDescription>{t('systemNodesPage.apiCall.description')}</SheetDescription>
        </SheetHeader>
        <ApiCallTool pending={pending} result={result} error={error} onRun={onRun} />
      </SheetContent>
    </Sheet>
  )
}

function NodeEnrollmentSheet({
  open,
  onOpenChange,
  enrollment,
  onCopyJwt,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  enrollment: CertificateClientEnrollment | null
  onCopyJwt: (homeJwt: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!enrollment?.homeJwt) return
    await onCopyJwt(enrollment.homeJwt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-hidden sm:max-w-xl">
        <SheetHeader className="border-b p-5 shadow-[0_1px_0_var(--border)]">
          <SheetTitle>{t('systemNodesPage.nodes.enrollment.title')}</SheetTitle>
          <SheetDescription>{t('systemNodesPage.nodes.enrollment.description')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          {enrollment?.id ? (
            <div className="grid gap-2">
              <p className="text-muted-foreground text-xs font-medium">
                {t('systemNodesPage.nodes.enrollment.clientId')}
              </p>
              <p className="font-mono text-sm break-all">{enrollment.id}</p>
            </div>
          ) : null}
          <div className="grid gap-2">
            <p className="text-muted-foreground text-xs font-medium">
              {t('systemNodesPage.nodes.enrollment.jwtLabel')}
            </p>
            <pre className="bg-muted/50 max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs leading-5 break-all whitespace-pre-wrap">
              {enrollment?.homeJwt ?? ''}
            </pre>
          </div>
          <Button type="button" className="w-full sm:w-auto" onClick={() => void handleCopy()}>
            {copied ? (
              <ClipboardCheck className="size-4" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {copied
              ? t('systemNodesPage.nodes.enrollment.copied')
              : t('systemNodesPage.nodes.enrollment.copyJwt')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function IssueList({ issues }: { issues: SystemIssue[] }) {
  const { t } = useTranslation()
  if (issues.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <div className="min-w-0">
          <h2 className="font-semibold text-amber-800 dark:text-amber-200">
            {t('systemNodesPage.issues.title')}
          </h2>
          <div className="mt-3 grid gap-2">
            {issues.map((issue) => (
              <div
                key={`${issue.scope}:${issue.message}`}
                className="text-amber-900 dark:text-amber-100"
              >
                <span className="font-medium">
                  {t(`systemNodesPage.issueScopes.${issue.scope}`)}
                </span>
                <span className="text-amber-800/80 dark:text-amber-100/80"> · {issue.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ApiCallTool({
  pending,
  result,
  error,
  onRun,
}: {
  pending: boolean
  result: ApiCallResult | undefined
  error: string | null
  onRun: (input: ApiCallInput) => Promise<void>
}) {
  const { t } = useTranslation()
  const [input, setInput] = useState<ApiCallInput>(defaultApiCallInput)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!input.url.trim()) {
      setLocalError(t('systemNodesPage.apiCall.validation.urlRequired'))
      return
    }

    const trimmedHeaders = input.headers.trim()
    if (trimmedHeaders) {
      try {
        const parsedHeaders = JSON.parse(trimmedHeaders) as unknown
        if (
          typeof parsedHeaders !== 'object' ||
          parsedHeaders === null ||
          Array.isArray(parsedHeaders)
        ) {
          setLocalError(t('systemNodesPage.apiCall.validation.headersObjectRequired'))
          return
        }
      } catch {
        setLocalError(t('systemNodesPage.apiCall.validation.headersJsonInvalid'))
        return
      }
    }

    try {
      setLocalError(null)
      await onRun(input)
    } catch (nextError) {
      setLocalError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  return (
    <div className="grid gap-4 p-5">
      <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
          <TerminalSquare className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            {t('systemNodesPage.apiCall.riskTitle')}
          </p>
          <p className="mt-1 leading-6 text-amber-900/80 dark:text-amber-100/80">
            {t('systemNodesPage.apiCall.warning')}
          </p>
        </div>
      </div>

      <form className="grid gap-3" onSubmit={(event) => void handleSubmit(event)}>
        <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
          <div className="grid gap-2 text-sm font-medium">
            <span>{t('systemNodesPage.apiCall.method')}</span>
            <Select
              value={input.method}
              disabled={pending}
              onValueChange={(method) => setInput((current) => ({ ...current, method }))}
            >
              <SelectTrigger aria-label={t('systemNodesPage.apiCall.method')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('systemNodesPage.apiCall.url')}</span>
            <Input
              value={input.url}
              disabled={pending}
              placeholder={t('systemNodesPage.apiCall.urlPlaceholder')}
              onChange={(event) => setInput((current) => ({ ...current, url: event.target.value }))}
            />
          </label>
        </div>
        <label className="grid gap-2 text-sm font-medium">
          <span>{t('systemNodesPage.apiCall.authIndex')}</span>
          <Input
            value={input.authIndex}
            disabled={pending}
            placeholder={t('systemNodesPage.apiCall.authIndexPlaceholder')}
            onChange={(event) =>
              setInput((current) => ({ ...current, authIndex: event.target.value }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          <span>{t('systemNodesPage.apiCall.headers')}</span>
          <Textarea
            className="min-h-28 font-mono text-xs"
            value={input.headers}
            disabled={pending}
            placeholder='{"Content-Type":"application/json"}'
            onChange={(event) =>
              setInput((current) => ({ ...current, headers: event.target.value }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          <span>{t('systemNodesPage.apiCall.body')}</span>
          <Textarea
            className="min-h-28 font-mono text-xs"
            value={input.data}
            disabled={pending}
            placeholder={t('systemNodesPage.apiCall.bodyPlaceholder')}
            onChange={(event) => setInput((current) => ({ ...current, data: event.target.value }))}
          />
        </label>

        {localError || error ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
            {localError ?? error}
          </div>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="size-4" aria-hidden="true" />
          )}
          {t('systemNodesPage.apiCall.run')}
        </Button>
      </form>

      {result ? (
        <div className="mt-4 rounded-md border p-3">
          <p className="text-sm font-medium">
            {t('systemNodesPage.apiCall.responseStatus', {
              status: result.statusCode ?? t('systemNodesPage.status.notAvailable'),
            })}
          </p>
          <pre className="bg-muted/50 mt-3 max-h-72 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
            {result.body || JSON.stringify(result.headers, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  )
}

export function SystemNodesWorkbenchPage() {
  const { t } = useTranslation()
  const workbench = useSystemNodesWorkbench()
  const [apiCallSheetOpen, setApiCallSheetOpen] = useState(false)
  const [nodeEnrollmentSheetOpen, setNodeEnrollmentSheetOpen] = useState(false)
  const [nodeEnrollment, setNodeEnrollment] = useState<CertificateClientEnrollment | null>(null)

  if (workbench.checking || (workbench.connected && !workbench.capabilityReady)) {
    return <SystemNodesLoadingState />
  }

  if (!workbench.connected) {
    return <SystemNodesDisconnectedState />
  }

  if (workbench.isPending) {
    return <SystemNodesLoadingState />
  }

  if (workbench.isError || !workbench.snapshot || !workbench.operationalStatus) {
    return (
      <SystemNodesErrorState errorMessage={workbench.errorMessage} onRetry={workbench.refetch} />
    )
  }

  const serverVersion =
    workbench.snapshot.homeVersion ??
    workbench.serverInfo.homeVersion ??
    workbench.serverInfo.cpaVersion ??
    t('systemNodesPage.status.unknown')
  const serverVersionAvailable = serverVersion !== t('systemNodesPage.status.unknown')
  const nodesSummaryDetail = workbench.capabilities.nodes
    ? workbench.snapshot.nodes.length > 0
      ? t('systemNodesPage.summary.nodesConnected', { count: workbench.snapshot.nodes.length })
      : t('systemNodesPage.summary.nodesEmpty')
    : t('systemNodesPage.summary.nodesUnavailable')
  const nodesSummaryTone: StatusTone = workbench.capabilities.nodes
    ? workbench.snapshot.nodes.length > 0
      ? 'success'
      : 'neutral'
    : 'info'

  const handleRunApiCall = async (input: ApiCallInput) => {
    await workbench.runApiCall(input)
    toast.success(t('systemNodesPage.toast.apiCallComplete'))
  }

  const handleAddNode = async () => {
    try {
      const enrollment = await workbench.createNodeClient()
      setNodeEnrollment(enrollment)
      setNodeEnrollmentSheetOpen(true)
      toast.success(t('systemNodesPage.toast.nodeClientCreated'))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message)
    }
  }

  const handleCopyNodeJwt = async (homeJwt: string) => {
    await copyTextToClipboard(homeJwt)
    toast.success(t('systemNodesPage.toast.nodeJwtCopied'))
  }

  return (
    <section className="grid w-full gap-4">
      <OperationalVerdictPanel
        status={workbench.operationalStatus}
        runtimeLabel={t(`runtimeMode.${workbench.runtimeMode}`)}
        probedAt={formatDateTime(workbench.probedAt)}
        fetchedAt={formatDateTime(workbench.snapshot.fetchedAt)}
        isFetching={workbench.isFetching}
        onRefresh={workbench.refetch}
        onOpenDiagnostics={() => setApiCallSheetOpen(true)}
      />

      <IssueList issues={workbench.snapshot.issues} />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label={t('systemNodesPage.summary.version')}
          value={serverVersion}
          detail={t('systemNodesPage.summary.latestVersion', {
            version: workbench.snapshot.latestVersion ?? t('systemNodesPage.status.unknown'),
          })}
          tone={serverVersionAvailable ? 'success' : 'warning'}
        />
        <SummaryCard
          label={t('systemNodesPage.summary.nodes')}
          value={String(workbench.snapshot.nodes.length)}
          detail={nodesSummaryDetail}
          tone={nodesSummaryTone}
        />
        <SummaryCard
          label={t('systemNodesPage.summary.config')}
          value={
            workbench.snapshot.config
              ? t('systemNodesPage.status.available')
              : t('systemNodesPage.status.notAvailable')
          }
          detail={
            workbench.snapshot.config
              ? t('systemNodesPage.summary.configAvailable')
              : t('systemNodesPage.summary.configUnavailable')
          }
          tone={workbench.snapshot.config ? 'success' : 'warning'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <div className="bg-card rounded-lg border p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{t('systemNodesPage.nodes.title')}</h2>
            <Button
              type="button"
              size="sm"
              disabled={workbench.createNodeClientPending}
              onClick={() => void handleAddNode()}
            >
              {workbench.createNodeClientPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              {t('systemNodesPage.nodes.addNode')}
            </Button>
          </div>
          <div className="mt-3">
            <NodesPanel
              nodes={workbench.snapshot.nodes}
              available={workbench.capabilities.nodes}
              runtimeLabel={t(`runtimeMode.${workbench.runtimeMode}`)}
            />
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4 shadow-sm">
          <h2 className="text-base font-semibold">{t('systemNodesPage.config.title')}</h2>
          <div className="mt-3">
            <ConfigSummaryPanel config={workbench.snapshot.config} />
          </div>
        </div>
      </div>

      <ApiCallSheet
        open={apiCallSheetOpen}
        onOpenChange={setApiCallSheetOpen}
        pending={workbench.apiCallPending}
        result={workbench.apiCallResult}
        error={workbench.apiCallError}
        onRun={handleRunApiCall}
      />

      <NodeEnrollmentSheet
        open={nodeEnrollmentSheetOpen}
        onOpenChange={setNodeEnrollmentSheetOpen}
        enrollment={nodeEnrollment}
        onCopyJwt={handleCopyNodeJwt}
      />
    </section>
  )
}
