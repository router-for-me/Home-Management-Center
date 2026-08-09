import { type FormEvent, type ReactNode, useEffect, useState } from 'react'

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Info,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  ServerCog,
  TerminalSquare,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  DrawerScaffoldBody,
  DrawerScaffoldContent,
  DrawerScaffoldFooter,
  DrawerScaffoldForm,
  DrawerScaffoldHeader,
} from '@/components/shared/drawer-scaffold'
import { TableEmptyState } from '@/components/shared/empty-state'
import { fieldClassName } from '@/components/shared/form-layout'
import { OverflowTooltipText } from '@/components/shared/overflow-tooltip-text'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  SystemHomeTopologyResource,
  SystemIssue,
  SystemNodeHealth,
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

type HomeTopologyGroup = {
  id: string
  label: string
  home: SystemHomeTopologyResource | null
  homeIp: string | null
  homePort: number | null
  nodes: SystemNodeResource[]
  healthyCpaCount: number
  totalClientCount: number
  latestSeenAt: string | null
  connectedSince: string | null
}

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
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getHomeGroupId(node: SystemNodeResource) {
  return node.homeId ?? (node.homeIp ? `${node.homeIp}:${node.homePort ?? 0}` : 'unknown-home')
}

function getHomeGroupLabel(homeIp: string | null, homePort: number | null) {
  if (!homeIp) return null
  return homePort ? `${homeIp}:${homePort}` : homeIp
}

function getHomeResourceLabel(home: SystemHomeTopologyResource) {
  return home.id || getHomeGroupLabel(home.ip, home.port) || 'unknown-home'
}

function getLatestTimestamp(values: Array<string | null>) {
  return values.reduce<string | null>((latest, value) => {
    if (!value) return latest
    const valueTime = new Date(value).getTime()
    if (Number.isNaN(valueTime)) return latest
    if (!latest) return value
    const latestTime = new Date(latest).getTime()
    return Number.isNaN(latestTime) || valueTime > latestTime ? value : latest
  }, null)
}

function getEarliestTimestamp(values: Array<string | null>) {
  return values.reduce<string | null>((earliest, value) => {
    if (!value) return earliest
    const valueTime = new Date(value).getTime()
    if (Number.isNaN(valueTime)) return earliest
    if (!earliest) return value
    const earliestTime = new Date(earliest).getTime()
    return Number.isNaN(earliestTime) || valueTime < earliestTime ? value : earliest
  }, null)
}

function deriveHomeTopologyGroups(
  homes: SystemHomeTopologyResource[],
  nodes: SystemNodeResource[],
): HomeTopologyGroup[] {
  const groups = new Map<
    string,
    {
      home: SystemHomeTopologyResource | null
      homeIp: string | null
      homePort: number | null
      nodes: SystemNodeResource[]
    }
  >()

  homes.forEach((home) => {
    groups.set(home.id, {
      home,
      homeIp: home.ip,
      homePort: home.port,
      nodes: [],
    })
  })

  nodes.forEach((node) => {
    const id = getHomeGroupId(node)
    const current = groups.get(id)

    if (current) {
      current.nodes.push(node)
      return
    }

    groups.set(id, {
      home: null,
      homeIp: node.homeIp,
      homePort: node.homePort,
      nodes: [node],
    })
  })

  return Array.from(groups.entries())
    .map(([id, group]) => ({
      id,
      label: group.home
        ? getHomeResourceLabel(group.home)
        : (getHomeGroupLabel(group.homeIp, group.homePort) ?? 'unknown-home'),
      home: group.home,
      homeIp: group.homeIp,
      homePort: group.homePort,
      nodes: group.nodes,
      healthyCpaCount: group.nodes.filter((node) => node.healthy === true).length,
      totalClientCount: group.nodes.reduce((total, node) => total + (node.clientCount ?? 0), 0),
      latestSeenAt: getLatestTimestamp(group.nodes.map((node) => node.lastSeenAt)),
      connectedSince: getEarliestTimestamp(group.nodes.map((node) => node.connectedTime)),
    }))
    .sort((first, second) => {
      if (first.homeIp && !second.homeIp) return -1
      if (!first.homeIp && second.homeIp) return 1
      return first.label.localeCompare(second.label)
    })
}

function getServingHomeCount(nodes: SystemNodeResource[]) {
  return new Set(
    nodes.flatMap((node) => {
      const homeId = getHomeGroupId(node)
      return homeId === 'unknown-home' ? [] : [homeId]
    }),
  ).size
}

function getHealthyCpaCount(nodes: SystemNodeResource[]) {
  return nodes.filter((node) => node.healthy === true).length
}

function getPluginAttentionCount(nodes: SystemNodeResource[]) {
  return nodes.filter(
    (node) => node.pluginReportState !== 'reported_ok' && node.pluginReportState !== 'not_required',
  ).length
}

function getUnknownTopologyCount(nodes: SystemNodeResource[]) {
  return nodes.filter((node) => !node.homeId && !node.homeIp).length
}

function getTopologyAttentionCount(nodes: SystemNodeResource[], issueCount: number) {
  const unhealthyCount = nodes.filter((node) => node.healthy === false).length
  return (
    issueCount + unhealthyCount + getPluginAttentionCount(nodes) + getUnknownTopologyCount(nodes)
  )
}

function getNodeHealthTone(node: SystemNodeResource): StatusTone {
  if (node.health === 'healthy' || node.healthy === true) return 'success'
  if (node.health === 'stale' || node.healthy === false) return 'danger'
  return 'warning'
}

function getHealthTone(health: SystemNodeHealth): StatusTone {
  if (health === 'healthy') return 'success'
  if (health === 'stale') return 'danger'
  return 'warning'
}

function getHomeRoleTone(role: SystemHomeTopologyResource['role']): StatusTone {
  if (role === 'master') return 'success'
  if (role === 'follower') return 'info'
  return 'warning'
}

function getPluginReportTone(node: SystemNodeResource): StatusTone {
  if (node.pluginReportState === 'reported_ok' || node.pluginReportState === 'not_required') {
    return 'success'
  }
  if (node.pluginReportState === 'reported_failed') return 'danger'
  if (node.pluginReportState === 'unknown') return 'warning'
  return 'warning'
}

function StatusBadge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: StatusTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
        statusToneStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

function NodeDetail({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="mt-1 truncate font-mono text-xs" title={value}>
        {value}
      </p>
    </div>
  )
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
      <Skeleton className="h-96 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
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
    <div className="bg-card rounded-lg border p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <OverflowTooltipText value={value} className="mt-1.5 text-lg font-semibold" />
        </div>
        <div
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-md border',
            statusToneStyles[tone],
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>
      <p className="text-muted-foreground mt-2 line-clamp-2 text-xs leading-5" title={detail}>
        {detail}
      </p>
    </div>
  )
}

function OperationalVerdictPanel({
  status,
  runtimeLabel,
  probedAt,
  fetchedAt,
  servingHomeCount,
  isFetching,
  onRefresh,
  onOpenDiagnostics,
}: {
  status: SystemNodesOperationalStatus
  runtimeLabel: string
  probedAt: string | null
  fetchedAt: string | null
  servingHomeCount: number
  isFetching: boolean
  onRefresh: () => void
  onOpenDiagnostics: () => void
}) {
  const { t } = useTranslation()
  const Icon = getOperationalIcon(status.level)
  const styles = operationalLevelStyles[status.level]

  const facts = [
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
        ? servingHomeCount > 0
          ? t('systemNodesPage.verdict.facts.nodesCluster', {
              count: status.nodeCount,
              homeCount: servingHomeCount,
            })
          : t('systemNodesPage.verdict.facts.nodes', { count: status.nodeCount })
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
            size="md"
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
          <Button variant="outline" size="md" onClick={onOpenDiagnostics}>
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

function ConfigSignal({ label, value, tone }: { label: string; value: string; tone: StatusTone }) {
  return (
    <div className="bg-background/70 inline-flex max-w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-2">
      <span className="text-muted-foreground min-w-0 truncate text-xs font-medium">{label}</span>
      <StatusBadge tone={tone} className="max-w-36 shrink-0 truncate border-0 px-1.5 py-0.5">
        {value}
      </StatusBadge>
    </div>
  )
}

function ConfigSignalGroup({
  title,
  items,
}: {
  title: string
  items: Array<{ key: string; label: string; value: string; tone: StatusTone }>
}) {
  return (
    <section className="bg-muted/25 rounded-md p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <ConfigSignal key={item.key} label={item.label} value={item.value} tone={item.tone} />
        ))}
      </div>
    </section>
  )
}

function ConfigSummaryPanel({ config }: { config: SystemConfigSummary | null }) {
  const { t } = useTranslation()

  if (!config) {
    return (
      <TableEmptyState kind="empty" className="m-0" title={t('systemNodesPage.config.empty')} />
    )
  }

  const enabledLabel = t('systemNodesPage.status.enabled')
  const disabledLabel = t('systemNodesPage.status.disabled')
  const booleanSignal = (
    key: 'debug' | 'requestLog' | 'usageStatistics' | 'loggingToFile' | 'proxyConfigured',
    enabled: boolean,
    enabledTone: StatusTone = 'info',
  ) => ({
    key,
    label: t(`systemNodesPage.config.fields.${key}`),
    value: enabled ? enabledLabel : disabledLabel,
    tone: enabled ? enabledTone : 'neutral',
  })

  const diagnostics = [
    booleanSignal('requestLog', config.requestLog),
    booleanSignal('usageStatistics', config.usageStatistics),
    booleanSignal('loggingToFile', config.loggingToFile),
  ]

  const runtime = [
    booleanSignal('debug', config.debug, 'warning'),
    booleanSignal('proxyConfigured', config.proxyConfigured),
    {
      key: 'routingStrategy',
      label: t('systemNodesPage.config.fields.routingStrategy'),
      value: t(`configPage.routingStrategies.${config.routingStrategy}`, {
        defaultValue:
          config.routingStrategy === 'unknown'
            ? t('systemNodesPage.status.unknown')
            : config.routingStrategy,
      }),
      tone: config.routingStrategy === 'unknown' ? 'warning' : 'neutral',
    },
  ] satisfies Array<{ key: string; label: string; value: string; tone: StatusTone }>

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <ConfigSignalGroup
        title={t('systemNodesPage.config.groups.diagnostics')}
        items={diagnostics}
      />
      <ConfigSignalGroup title={t('systemNodesPage.config.groups.runtime')} items={runtime} />
    </div>
  )
}

const CPA_NODE_NAME_MAX_LENGTH = 128

type CpaNodeNameValidation =
  | { ok: true; name: string | null }
  | { ok: false; error: 'tooLong' | 'invalidChars' }

// Mirror the backend contract for `PATCH /nodes/:id`: trim, treat empty as a
// clear (null), cap at 128 Unicode code points, and reject control characters.
function validateCpaNodeNameDraft(value: string): CpaNodeNameValidation {
  const trimmed = value.trim()
  if (trimmed === '') return { ok: true, name: null }
  if (Array.from(trimmed).length > CPA_NODE_NAME_MAX_LENGTH) {
    return { ok: false, error: 'tooLong' }
  }
  if (/\p{Cc}/u.test(trimmed)) return { ok: false, error: 'invalidChars' }
  return { ok: true, name: trimmed }
}

// The rename mutation preserves the backend code via toManagementApiError; read
// it locally instead of importing the credentials-module error matcher.
function readNodeRenameErrorCode(error: unknown): string | null {
  if (error !== null && typeof error === 'object' && 'backendCode' in error) {
    const code = (error as { backendCode?: unknown }).backendCode
    if (typeof code === 'string') return code
  }
  return null
}

function CpaNodeRow({
  node,
  onRename,
}: {
  node: SystemNodeResource
  onRename: (node: SystemNodeResource) => void
}) {
  const { t } = useTranslation()
  const healthLabel = t(`systemNodesPage.healthStates.${node.health}`)
  const hasName = node.nodeName !== null && node.nodeName !== ''
  const canRename = node.nodeId !== null && node.nodeNameSupported
  const identityLabel = node.nodeName ?? node.ip

  return (
    <div className="grid gap-3 border-t px-3 py-3 lg:grid-cols-[minmax(120px,0.65fr)_minmax(0,2.6fr)_auto] lg:items-start">
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-medium">
          {hasName
            ? t('systemNodesPage.nodes.fields.nodeName')
            : t('systemNodesPage.nodes.fields.cpaIp')}
        </p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
          <p className={cn('truncate text-sm', hasName ? 'font-medium' : 'font-mono')}>
            {identityLabel}
          </p>
          {canRename ? (
            <Button
              type="button"
              variant="text"
              size="icon-xs"
              className="hover:text-primary focus-visible:text-primary"
              onClick={() => onRename(node)}
              aria-label={
                hasName
                  ? t('systemNodesPage.nodes.rename.ariaLabel', { name: identityLabel })
                  : t('systemNodesPage.nodes.rename.setAriaLabel', { name: identityLabel })
              }
            >
              <Pencil aria-hidden="true" />
            </Button>
          ) : null}
          <StatusBadge tone={getNodeHealthTone(node)}>{healthLabel}</StatusBadge>
        </div>
        {hasName ? (
          <p className="text-muted-foreground mt-1 truncate font-mono text-xs">{node.ip}</p>
        ) : null}
      </div>
      <div className="grid min-w-0 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.6fr)_minmax(160px,1fr)_minmax(160px,1fr)_minmax(72px,0.45fr)]">
        <NodeDetail
          label={t('systemNodesPage.nodes.fields.nodeId')}
          value={node.nodeId ?? t('systemNodesPage.status.notAvailable')}
        />
        <NodeDetail
          label={t('systemNodesPage.nodes.fields.connectedTime')}
          value={formatDateTime(node.connectedTime) ?? t('systemNodesPage.status.notAvailable')}
        />
        <NodeDetail
          label={t('systemNodesPage.nodes.fields.lastSeen')}
          value={formatDateTime(node.lastSeenAt) ?? t('systemNodesPage.status.notAvailable')}
        />
        <NodeDetail
          label={t('systemNodesPage.nodes.fields.clientCount')}
          value={String(node.clientCount ?? 0)}
        />
      </div>
      <div className="flex items-center lg:justify-self-end">
        <StatusBadge tone={getPluginReportTone(node)}>
          {t(`systemNodesPage.nodes.pluginStates.${node.pluginReportState}`)}
        </StatusBadge>
      </div>
    </div>
  )
}

function HomeTopologyGroupSection({
  group,
  onRenameNode,
}: {
  group: HomeTopologyGroup
  onRenameNode: (node: SystemNodeResource) => void
}) {
  const { t } = useTranslation()
  const isUnknownHome = !group.home && !group.homeIp
  const role = group.home?.role ?? 'unknown'
  const health = group.home?.health ?? 'unknown'
  const cpaCount = group.home?.cpaCount ?? group.nodes.length
  const healthyCpaCount = group.home?.healthyCpaCount ?? group.healthyCpaCount
  const clientCount = group.home?.clientCount ?? group.totalClientCount
  const lastSeenAt = group.home?.lastSeenAt ?? group.latestSeenAt
  const connectedSince = group.home?.startedAt ?? group.connectedSince

  return (
    <section
      className={cn(
        'overflow-hidden rounded-md border',
        isUnknownHome ? 'border-warning/35 bg-warning/5' : 'border-border/70 bg-background/45',
      )}
    >
      <div className="px-3 py-3">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium">
              {t('systemNodesPage.nodes.fields.homeEndpoint')}
            </p>
            <p className="mt-1 truncate font-mono text-sm">
              {isUnknownHome ? t('systemNodesPage.nodes.unknownHome') : group.label}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {isUnknownHome ? (
              <StatusBadge tone="warning">{t('systemNodesPage.status.partial')}</StatusBadge>
            ) : null}
            <StatusBadge tone={getHomeRoleTone(role)}>
              {t(`systemNodesPage.homeRoles.${role}`)}
            </StatusBadge>
            <StatusBadge tone={getHealthTone(health)}>
              {t(`systemNodesPage.healthStates.${health}`)}
            </StatusBadge>
            <StatusBadge
              tone={
                cpaCount === 0 ? 'neutral' : healthyCpaCount === cpaCount ? 'success' : 'warning'
              }
            >
              {t('systemNodesPage.nodes.healthyRatio', {
                healthy: healthyCpaCount,
                total: cpaCount,
              })}
            </StatusBadge>
          </div>
        </div>
        <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-5">
          <NodeDetail
            label={t('systemNodesPage.nodes.fields.homeRole')}
            value={t(`systemNodesPage.homeRoles.${role}`)}
          />
          <NodeDetail label={t('systemNodesPage.nodes.fields.cpaCount')} value={String(cpaCount)} />
          <NodeDetail
            label={t('systemNodesPage.nodes.fields.clientCount')}
            value={String(clientCount ?? 0)}
          />
          <NodeDetail
            label={t('systemNodesPage.nodes.fields.connectedSince')}
            value={formatDateTime(connectedSince) ?? t('systemNodesPage.status.notAvailable')}
          />
          <NodeDetail
            label={t('systemNodesPage.nodes.fields.lastSeen')}
            value={formatDateTime(lastSeenAt) ?? t('systemNodesPage.status.notAvailable')}
          />
        </div>
        {isUnknownHome ? (
          <p className="text-muted-foreground mt-3 text-xs leading-5">
            {t('systemNodesPage.nodes.unknownHomeDescription')}
          </p>
        ) : null}
      </div>
      <div className="bg-muted/20">
        {group.nodes.length > 0 ? (
          group.nodes.map((node) => (
            <CpaNodeRow key={node.id} node={node} onRename={onRenameNode} />
          ))
        ) : (
          <div className="border-t px-3 py-3">
            <TableEmptyState
              kind="empty"
              className="m-0"
              title={t('systemNodesPage.nodes.noCpaInHome')}
            />
          </div>
        )}
      </div>
    </section>
  )
}

function HomeTopologyPanel({
  groups,
  available,
  runtimeLabel,
  onRenameNode,
}: {
  groups: HomeTopologyGroup[]
  available: boolean
  runtimeLabel: string
  onRenameNode: (node: SystemNodeResource) => void
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

  if (groups.length === 0) {
    return (
      <TableEmptyState
        kind="empty"
        className="m-0"
        title={t('systemNodesPage.nodes.emptySupported')}
      />
    )
  }

  return (
    <div className="grid gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <StatusBadge tone={groups.length > 0 ? 'info' : 'warning'}>
          {t('systemNodesPage.nodes.homeRecordsStatus', { count: groups.length })}
        </StatusBadge>
        <StatusBadge tone="neutral">
          {t('systemNodesPage.nodes.cpaRecordsStatus', {
            count: groups.reduce((total, group) => total + group.nodes.length, 0),
          })}
        </StatusBadge>
      </div>
      {groups.map((group) => (
        <HomeTopologyGroupSection key={group.id} group={group} onRenameNode={onRenameNode} />
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
  pending,
  onGenerate,
  onCopyJwt,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  enrollment: CertificateClientEnrollment | null
  pending: boolean
  onGenerate: (nodeName: string | null) => Promise<void>
  onCopyJwt: (homeJwt: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [nameDraft, setNameDraft] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Each open starts a fresh enrollment: clear the name draft, its validation
  // message, and the copied flag so nothing leaks in from the previous run.
  useEffect(() => {
    if (open) {
      setNameDraft('')
      setValidationError(null)
      setCopied(false)
    }
  }, [open])

  const describeError = (kind: 'tooLong' | 'invalidChars') =>
    kind === 'tooLong'
      ? t('systemNodesPage.nodes.rename.tooLong', { max: CPA_NODE_NAME_MAX_LENGTH })
      : t('systemNodesPage.nodes.rename.invalidChars')

  const handleNameChange = (next: string) => {
    setNameDraft(next)
    const result = validateCpaNodeNameDraft(next)
    setValidationError(result.ok ? null : describeError(result.error))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = validateCpaNodeNameDraft(nameDraft)
    if (!result.ok) {
      setValidationError(describeError(result.error))
      return
    }
    // The page handler owns the success/error toasts and never rethrows; on
    // failure the sheet just stays in input mode so the name can be corrected.
    await onGenerate(result.name)
  }

  const handleCopy = async () => {
    if (!enrollment?.homeJwt) return
    await onCopyJwt(enrollment.homeJwt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <DrawerScaffoldContent className="sm:max-w-xl">
        <DrawerScaffoldHeader>
          <SheetTitle>{t('systemNodesPage.nodes.enrollment.title')}</SheetTitle>
          <SheetDescription>
            {enrollment
              ? t('systemNodesPage.nodes.enrollment.description')
              : t('systemNodesPage.nodes.enrollment.nameStepDescription')}
          </SheetDescription>
        </DrawerScaffoldHeader>
        {enrollment ? (
          <>
            <DrawerScaffoldBody className="grid gap-4">
              {enrollment.id ? (
                <div className="grid gap-2">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t('systemNodesPage.nodes.enrollment.clientId')}
                  </p>
                  <p className="font-mono text-sm break-all">{enrollment.id}</p>
                </div>
              ) : null}
              {enrollment.nodeName ? (
                <div className="grid gap-2">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t('systemNodesPage.nodes.rename.label')}
                  </p>
                  <p className="text-sm break-all">{enrollment.nodeName}</p>
                </div>
              ) : null}
              <div className="grid gap-2">
                <p className="text-muted-foreground text-xs font-medium">
                  {t('systemNodesPage.nodes.enrollment.jwtLabel')}
                </p>
                <pre className="bg-muted/50 max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs leading-5 break-all whitespace-pre-wrap">
                  {enrollment.homeJwt}
                </pre>
              </div>
            </DrawerScaffoldBody>
            <DrawerScaffoldFooter>
              <Button type="button" onClick={() => void handleCopy()}>
                {copied ? (
                  <ClipboardCheck className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
                {copied
                  ? t('systemNodesPage.nodes.enrollment.copied')
                  : t('systemNodesPage.nodes.enrollment.copyJwt')}
              </Button>
            </DrawerScaffoldFooter>
          </>
        ) : (
          <DrawerScaffoldForm onSubmit={(event) => void handleSubmit(event)}>
            <DrawerScaffoldBody className="grid gap-4">
              <label className={fieldClassName}>
                <span>{t('systemNodesPage.nodes.rename.label')}</span>
                <Input
                  value={nameDraft}
                  autoFocus
                  disabled={pending}
                  placeholder={t('systemNodesPage.nodes.rename.placeholder')}
                  onChange={(event) => handleNameChange(event.target.value)}
                />
                <span className="text-muted-foreground text-xs leading-5 font-normal">
                  {t('systemNodesPage.nodes.enrollment.nameHint', {
                    max: CPA_NODE_NAME_MAX_LENGTH,
                  })}
                </span>
              </label>
              {validationError ? (
                <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
                  {validationError}
                </p>
              ) : null}
            </DrawerScaffoldBody>
            <DrawerScaffoldFooter>
              <Button type="submit" disabled={pending || validationError !== null}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {t('systemNodesPage.nodes.enrollment.generate')}
              </Button>
            </DrawerScaffoldFooter>
          </DrawerScaffoldForm>
        )}
      </DrawerScaffoldContent>
    </Sheet>
  )
}

function CpaNodeRenameForm({
  node,
  pending,
  onCancel,
  onSubmit,
}: {
  node: SystemNodeResource
  pending: boolean
  onCancel: () => void
  onSubmit: (nodeId: string, nodeName: string | null) => Promise<void>
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState(node.nodeName ?? '')
  const [error, setError] = useState<string | null>(null)

  const describeError = (kind: 'tooLong' | 'invalidChars') =>
    kind === 'tooLong'
      ? t('systemNodesPage.nodes.rename.tooLong', { max: CPA_NODE_NAME_MAX_LENGTH })
      : t('systemNodesPage.nodes.rename.invalidChars')

  const handleChange = (next: string) => {
    setValue(next)
    const result = validateCpaNodeNameDraft(next)
    setError(result.ok ? null : describeError(result.error))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!node.nodeId) return
    const result = validateCpaNodeNameDraft(value)
    if (!result.ok) {
      setError(describeError(result.error))
      return
    }
    // The page handler owns success/error toasts and closes the dialog on
    // success; it never rethrows, so an awaited failure just keeps this open.
    await onSubmit(node.nodeId, result.name)
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
      <label className={fieldClassName}>
        <span>{t('systemNodesPage.nodes.rename.label')}</span>
        <Input
          value={value}
          autoFocus
          disabled={pending}
          placeholder={t('systemNodesPage.nodes.rename.placeholder')}
          onChange={(event) => handleChange(event.target.value)}
        />
        <span className="text-muted-foreground text-xs leading-5 font-normal">
          {t('systemNodesPage.nodes.rename.hint', { max: CPA_NODE_NAME_MAX_LENGTH })}
        </span>
      </label>
      {error ? (
        <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={pending || error !== null}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {t('systemNodesPage.nodes.rename.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

function CpaNodeRenameDialog({
  node,
  open,
  pending,
  onOpenChange,
  onSubmit,
}: {
  node: SystemNodeResource | null
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (nodeId: string, nodeName: string | null) => Promise<void>
}) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('systemNodesPage.nodes.rename.title')}</DialogTitle>
          <DialogDescription>{t('systemNodesPage.nodes.rename.description')}</DialogDescription>
        </DialogHeader>
        {node ? (
          <CpaNodeRenameForm
            key={node.id}
            node={node}
            pending={pending}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        ) : null}
      </DialogContent>
    </Dialog>
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
          <label className={fieldClassName}>
            <span>{t('systemNodesPage.apiCall.url')}</span>
            <Input
              value={input.url}
              disabled={pending}
              placeholder={t('systemNodesPage.apiCall.urlPlaceholder')}
              onChange={(event) => setInput((current) => ({ ...current, url: event.target.value }))}
            />
          </label>
        </div>
        <label className={fieldClassName}>
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
        <label className={fieldClassName}>
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
        <label className={fieldClassName}>
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
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<SystemNodeResource | null>(null)

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
  const topologyGroups = deriveHomeTopologyGroups(
    workbench.snapshot.homes,
    workbench.snapshot.nodes,
  )
  const topologySummary = workbench.snapshot.topology?.summary ?? null
  const servingHomeCount = getServingHomeCount(workbench.snapshot.nodes)
  const homeCount = topologySummary?.homeCount ?? servingHomeCount
  const healthyHomeCount = topologySummary?.healthyHomeCount ?? null
  const cpaCount = topologySummary?.cpaCount ?? workbench.snapshot.nodes.length
  const healthyCpaCount =
    topologySummary?.healthyCpaCount ?? getHealthyCpaCount(workbench.snapshot.nodes)
  const attentionCount = topologySummary
    ? topologySummary.attentionCount + workbench.snapshot.issues.length
    : getTopologyAttentionCount(workbench.snapshot.nodes, workbench.snapshot.issues.length)
  const topologyAvailable = workbench.capabilities.topology || workbench.capabilities.nodes
  const masterHome =
    workbench.snapshot.topology?.master?.id ?? t('systemNodesPage.status.notAvailable')
  const nodesSummaryDetail = topologyAvailable
    ? workbench.snapshot.topologySource === 'topology'
      ? t('systemNodesPage.summary.topologyConnected', {
          cpaCount,
          homeCount,
        })
      : workbench.snapshot.nodes.length > 0
        ? servingHomeCount > 0
          ? t('systemNodesPage.summary.nodesClusterConnected', {
              cpaCount: workbench.snapshot.nodes.length,
              homeCount: servingHomeCount,
            })
          : t('systemNodesPage.summary.nodesConnected', { count: workbench.snapshot.nodes.length })
        : t('systemNodesPage.summary.nodesEmpty')
    : t('systemNodesPage.summary.nodesUnavailable')
  const nodesSummaryTone: StatusTone = topologyAvailable
    ? cpaCount > 0
      ? 'success'
      : 'neutral'
    : 'info'

  const handleRunApiCall = async (input: ApiCallInput) => {
    await workbench.runApiCall(input)
    toast.success(t('systemNodesPage.toast.apiCallComplete'))
  }

  const handleAddNode = () => {
    // Opening is instant now: the sheet starts in input mode so the operator can
    // name the node before the single POST that mints (and binds) the JWT.
    setNodeEnrollment(null)
    setNodeEnrollmentSheetOpen(true)
  }

  const handleGenerateNode = async (nodeName: string | null) => {
    try {
      const enrollment = await workbench.createNodeClient(nodeName)
      setNodeEnrollment(enrollment)
      toast.success(t('systemNodesPage.toast.nodeClientCreated'))
    } catch (error) {
      if (readNodeRenameErrorCode(error) === 'cpa_node_name_invalid') {
        toast.error(t('systemNodesPage.nodes.rename.invalidChars'))
      } else {
        toast.error(error instanceof Error ? error.message : String(error))
      }
    }
  }

  const handleCopyNodeJwt = async (homeJwt: string) => {
    await copyTextToClipboard(homeJwt)
    toast.success(t('systemNodesPage.toast.nodeJwtCopied'))
  }

  const handleOpenRename = (node: SystemNodeResource) => {
    setRenameTarget(node)
    setRenameDialogOpen(true)
  }

  const handleRenameNode = async (nodeId: string, nodeName: string | null) => {
    try {
      await workbench.renameNode({ nodeId, nodeName })
      toast.success(
        nodeName
          ? t('systemNodesPage.toast.nodeRenamed')
          : t('systemNodesPage.toast.nodeNameCleared'),
      )
      setRenameDialogOpen(false)
    } catch (error) {
      const code = readNodeRenameErrorCode(error)
      if (code === 'cpa_node_name_invalid') {
        toast.error(t('systemNodesPage.nodes.rename.invalidChars'))
      } else if (code === 'cpa_node_not_found') {
        toast.error(t('systemNodesPage.nodes.rename.notFound'))
      } else {
        toast.error(error instanceof Error ? error.message : String(error))
      }
    }
  }

  return (
    <section className="grid w-full gap-4">
      <OperationalVerdictPanel
        status={workbench.operationalStatus}
        runtimeLabel={t(`runtimeMode.${workbench.runtimeMode}`)}
        probedAt={formatDateTime(workbench.probedAt)}
        fetchedAt={formatDateTime(workbench.snapshot.fetchedAt)}
        servingHomeCount={homeCount}
        isFetching={workbench.isFetching}
        onRefresh={workbench.refetch}
        onOpenDiagnostics={() => setApiCallSheetOpen(true)}
      />

      <IssueList issues={workbench.snapshot.issues} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          label={t('systemNodesPage.summary.version')}
          value={serverVersion}
          detail={t('systemNodesPage.summary.latestVersion', {
            version: workbench.snapshot.latestVersion ?? t('systemNodesPage.status.unknown'),
          })}
          tone={serverVersionAvailable ? 'success' : 'warning'}
        />
        <SummaryCard
          label={t('systemNodesPage.summary.endpoint')}
          value={workbench.managementEndpoint || t('systemNodesPage.status.notAvailable')}
          detail={t('systemNodesPage.summary.masterHome', { home: masterHome })}
          tone={workbench.managementEndpoint ? 'info' : 'warning'}
        />
        <SummaryCard
          label={t('systemNodesPage.summary.homes')}
          value={topologyAvailable ? String(homeCount) : t('systemNodesPage.status.notAvailable')}
          detail={
            workbench.snapshot.topologySource === 'topology' && healthyHomeCount !== null
              ? t('systemNodesPage.summary.homesHealthy', {
                  healthy: healthyHomeCount,
                  total: homeCount,
                })
              : homeCount > 0
                ? t('systemNodesPage.summary.homesInferred', { count: homeCount })
                : t('systemNodesPage.summary.homesUnavailable')
          }
          tone={homeCount > 0 ? 'info' : 'warning'}
        />
        <SummaryCard
          label={t('systemNodesPage.summary.cpas')}
          value={String(cpaCount)}
          detail={t('systemNodesPage.summary.cpasHealthy', {
            healthy: healthyCpaCount,
            total: cpaCount,
          })}
          tone={nodesSummaryTone}
        />
        <SummaryCard
          label={t('systemNodesPage.summary.attention')}
          value={String(attentionCount)}
          detail={
            attentionCount > 0
              ? t('systemNodesPage.summary.attentionDetail')
              : t('systemNodesPage.summary.attentionClear')
          }
          tone={attentionCount > 0 ? 'warning' : 'success'}
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

      <div className="bg-card rounded-lg border p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{t('systemNodesPage.nodes.title')}</h2>
              <StatusBadge tone={topologyAvailable ? 'info' : 'warning'}>
                {t(`systemNodesPage.topologySources.${workbench.snapshot.topologySource}`)}
              </StatusBadge>
            </div>
            <p className="text-muted-foreground mt-1 text-xs leading-5">{nodesSummaryDetail}</p>
          </div>
          <Button type="button" size="md" className="lg:shrink-0" onClick={handleAddNode}>
            <Plus className="size-4" aria-hidden="true" />
            {t('systemNodesPage.nodes.addNode')}
          </Button>
        </div>
        <div className="mt-4">
          <HomeTopologyPanel
            groups={topologyGroups}
            available={topologyAvailable}
            runtimeLabel={t(`runtimeMode.${workbench.runtimeMode}`)}
            onRenameNode={handleOpenRename}
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border p-4 shadow-sm">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t('systemNodesPage.config.title')}</h2>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            {t('systemNodesPage.config.description')}
          </p>
        </div>
        <div className="mt-3">
          <ConfigSummaryPanel config={workbench.snapshot.config} />
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
        pending={workbench.createNodeClientPending}
        onGenerate={handleGenerateNode}
        onCopyJwt={handleCopyNodeJwt}
      />

      <CpaNodeRenameDialog
        node={renameTarget}
        open={renameDialogOpen}
        pending={workbench.renameNodePending}
        onOpenChange={setRenameDialogOpen}
        onSubmit={handleRenameNode}
      />
    </section>
  )
}
