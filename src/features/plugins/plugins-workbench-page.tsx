import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'

import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  Download,
  ExternalLink,
  Eye,
  Info,
  KeyRound,
  Loader2,
  Package,
  Plug,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  X,
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
import { PageHeader } from '@/components/shared/page-header'
import { RowActions } from '@/components/shared/row-actions'
import { useSecondaryColumns } from '@/components/shared/table-columns'
import {
  TableSurface,
  TableSurfaceContent,
  TableSurfaceHeader,
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
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PluginStoreAuthSheet } from '@/features/plugins/plugin-store-auth-sheet'
import {
  type PluginStatusFilter,
  isPluginInstallActionDisabled,
} from '@/features/plugins/plugin-store-model'
import {
  type PluginPageVerdict,
  usePluginConfig,
  usePluginWorkbench,
} from '@/features/plugins/use-plugin-workbench'
import type {
  PluginConfigFieldDescriptor,
  PluginConfigSaveInput,
  PluginStoreEntry,
} from '@/lib/api/management/plugin-store'
import type { SystemPluginReportStatus } from '@/lib/api/management/system-nodes'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type BadgeTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

type PluginReportView = SystemPluginReportStatus & {
  servingHome: string | null
}

type PluginOperationNotice = {
  pluginId: string
  sourceKey: string
  name: string
  tone: BadgeTone
  messageKey: string
}

const verdictTone: Record<PluginPageVerdict, BadgeTone> = {
  ready: 'success',
  unsupported: 'info',
  storeError: 'danger',
  sourceDegraded: 'warning',
  globalDisabled: 'warning',
  rolloutFailed: 'danger',
  rolloutPending: 'warning',
  updatesAvailable: 'info',
}

const badgeToneStyles: Record<BadgeTone, string> = {
  success: 'border-success/30 bg-success/10 text-success',
  info: 'border-info/30 bg-info/10 text-info',
  warning: 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
  neutral: 'border-border bg-muted text-muted-foreground',
}

function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium',
        badgeToneStyles[tone],
      )}
    >
      {children}
    </span>
  )
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getPluginTitle(plugin: PluginStoreEntry) {
  return plugin.name || plugin.id
}

function getPluginSourceLabel(plugin: PluginStoreEntry) {
  return plugin.sourceName || plugin.sourceId || plugin.sourceUrl
}

function getPluginSourceKey(plugin: PluginStoreEntry) {
  return plugin.sourceId || plugin.sourceUrl || plugin.storeId
}

function buildRepositoryUrl(repository: string) {
  const trimmed = repository.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://github.com/${trimmed.replace(/^\/+/, '')}`
}

function getRepositorySlug(repository: string) {
  const trimmed = repository.trim()
  if (!trimmed) return ''
  const withoutHost = /^https?:\/\/[^/]+\/(.+)$/i.exec(trimmed)?.[1] ?? trimmed
  const [owner = '', repo = ''] = withoutHost.replace(/^\/+/, '').split('/')
  if (!owner) return ''
  return repo ? `${owner}/${repo.replace(/\.git$/i, '')}` : owner
}

function isOfficialPlugin(plugin: PluginStoreEntry) {
  return buildRepositoryUrl(plugin.repository)
    .toLowerCase()
    .startsWith('https://github.com/router-for-me/')
}

function getConfirmToken(plugin: PluginStoreEntry) {
  return getRepositorySlug(plugin.repository) || plugin.id
}

function formatVersion(version: string) {
  const trimmed = version.trim()
  if (!trimmed) return ''
  return /^v/i.test(trimmed) ? trimmed : `v${trimmed}`
}

function getInstallTypeLabel(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ')
}

function getPluginReports(
  plugin: PluginStoreEntry,
  reports: SystemPluginReportStatus[] | undefined,
) {
  return (reports ?? []).filter((report) =>
    report.plugins.some((reportPlugin) => reportPlugin.id === plugin.id),
  )
}

function getReportKey(report: SystemPluginReportStatus) {
  return [
    report.nodeType,
    report.nodeId,
    report.clientIp,
    report.task,
    report.phase,
    report.updatedAt,
    report.status,
  ]
    .map((value) => value ?? '')
    .join('|')
}

function getAllPluginReports(
  plugin: PluginStoreEntry,
  workbench: ReturnType<typeof usePluginWorkbench>,
) {
  const reportsByKey = new Map<string, PluginReportView>()
  const addReport = (report: SystemPluginReportStatus, servingHome: string | null) => {
    const key = getReportKey(report)
    const current = reportsByKey.get(key)
    reportsByKey.set(key, {
      ...current,
      ...report,
      servingHome: current?.servingHome ?? servingHome,
    })
  }

  getPluginReports(plugin, workbench.snapshot?.nodeReports?.pluginReportStatuses).forEach(
    (report) => addReport(report, null),
  )

  workbench.snapshot?.nodeReports?.nodes.forEach((node) => {
    const servingHome = node.homeIp
      ? node.homePort
        ? `${node.homeIp}:${node.homePort}`
        : node.homeIp
      : null

    getPluginReports(plugin, node.pluginReportStatuses).forEach((report) =>
      addReport(
        {
          ...report,
          clientIp: report.clientIp ?? node.ip,
          nodeId: report.nodeId ?? node.nodeId,
        },
        servingHome,
      ),
    )
  })

  return [...reportsByKey.values()]
}

function getPluginRolloutBadge(plugin: PluginStoreEntry, reports: SystemPluginReportStatus[]) {
  if (!plugin.installed) {
    return { tone: 'neutral' as const, labelKey: 'pluginPage.rollout.notInstalled' }
  }

  if (reports.length === 0) {
    return { tone: 'neutral' as const, labelKey: 'pluginPage.rollout.noReports' }
  }

  const hasFailure = reports.some((report) => {
    const reportPlugin = report.plugins.find((item) => item.id === plugin.id)
    const pluginStatuses = [
      reportPlugin?.installStatus,
      reportPlugin?.loadStatus,
      reportPlugin?.deleteStatus,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return report.ok === false || report.status === 'failed' || pluginStatuses.includes('failed')
  })

  if (hasFailure) {
    return { tone: 'danger' as const, labelKey: 'pluginPage.rollout.failed' }
  }

  const hasSuccess = reports.some((report) => report.ok === true || report.status === 'success')
  if (hasSuccess) {
    return { tone: 'success' as const, labelKey: 'pluginPage.rollout.reported' }
  }

  return { tone: 'warning' as const, labelKey: 'pluginPage.rollout.pending' }
}

function getAuthTone(plugin: PluginStoreEntry): BadgeTone {
  return plugin.authRequired ? 'warning' : 'neutral'
}

function getEffectiveTone(plugin: PluginStoreEntry): BadgeTone {
  if (plugin.effectiveEnabled) return 'success'
  if (plugin.installed && !plugin.effectiveEnabled) return 'warning'
  return 'neutral'
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return String(error)
}

function PluginsDisconnectedState() {
  const { t } = useTranslation()
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-md">
              <Plug className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">
                {t('pluginPage.disconnected.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {t('pluginPage.disconnected.description')}
              </p>
            </div>
          </div>
          <Button className="md:shrink-0" onClick={openConnectionDialog}>
            <Plug className="size-4" aria-hidden="true" />
            {t('pluginPage.disconnected.action')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function PluginsLoadingState() {
  return (
    <section className="grid gap-4">
      <Skeleton className="h-32 rounded-lg" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </section>
  )
}

function PluginsErrorState({
  kind,
  message,
  onRetry,
  onManageAuth,
}: {
  kind: 'unsupported' | 'error'
  message: string | null
  onRetry: () => void
  onManageAuth: () => void
}) {
  const { t } = useTranslation()
  const unsupported = kind === 'unsupported'

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-md border',
                unsupported
                  ? 'border-info/30 bg-info/10 text-info'
                  : 'border-destructive/30 bg-destructive/10 text-destructive',
              )}
            >
              {unsupported ? (
                <Info className="size-5" aria-hidden="true" />
              ) : (
                <AlertTriangle className="size-5" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">
                {t(unsupported ? 'pluginPage.unsupported.title' : 'pluginPage.error.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {message ??
                  t(
                    unsupported
                      ? 'pluginPage.unsupported.description'
                      : 'pluginPage.error.description',
                  )}
              </p>
            </div>
          </div>
          {!unsupported ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" onClick={onManageAuth}>
                <KeyRound className="size-4" aria-hidden="true" />
                {t('pluginPage.actions.manageAuth')}
              </Button>
              <Button variant="outline" onClick={onRetry}>
                <RefreshCw className="size-4" aria-hidden="true" />
                {t('pluginPage.actions.refresh')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function PluginSummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone: BadgeTone
}) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'danger' ? AlertTriangle : Info

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
            badgeToneStyles[tone],
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>
      <p className="text-muted-foreground mt-2 text-xs leading-5">{detail}</p>
    </div>
  )
}

function PluginDetailSheet({
  plugin,
  onClose,
  onManageAuth,
  onOpenConfig,
  reports,
}: {
  plugin: PluginStoreEntry | null
  onClose: () => void
  onManageAuth: () => void
  onOpenConfig: (plugin: PluginStoreEntry) => void
  reports: PluginReportView[]
}) {
  const { t } = useTranslation()
  if (!plugin) return null

  const repositoryUrl = buildRepositoryUrl(plugin.repository)
  const homepageUrl = /^https?:\/\//i.test(plugin.homepage) ? plugin.homepage : ''

  return (
    <Sheet open={Boolean(plugin)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{getPluginTitle(plugin)}</SheetTitle>
          <SheetDescription>{plugin.id}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6">
          <section className="grid gap-3 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">{t('pluginPage.detail.identity')}</h3>
            <div className="grid gap-2 text-sm">
              <DetailRow
                label={t('pluginPage.fields.source')}
                value={getPluginSourceLabel(plugin)}
              />
              <DetailRow label={t('pluginPage.fields.author')} value={plugin.author} />
              <DetailRow
                label={t('pluginPage.fields.repository')}
                value={plugin.repository}
                href={repositoryUrl}
              />
              <DetailRow
                label={t('pluginPage.fields.homepage')}
                value={plugin.homepage}
                href={homepageUrl}
              />
              <DetailRow label={t('pluginPage.fields.license')} value={plugin.license} />
              <DetailRow
                label={t('pluginPage.fields.installType')}
                value={getInstallTypeLabel(plugin.installType)}
              />
            </div>
          </section>
          <section className="grid gap-3 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">{t('pluginPage.detail.state')}</h3>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={plugin.installed ? 'success' : 'neutral'}>
                {plugin.installed
                  ? t('pluginPage.badges.installed')
                  : t('pluginPage.badges.notInstalled')}
              </StatusBadge>
              <StatusBadge tone={plugin.configured ? 'success' : 'neutral'}>
                {plugin.configured
                  ? t('pluginPage.badges.configured')
                  : t('pluginPage.badges.notConfigured')}
              </StatusBadge>
              <StatusBadge tone={plugin.registered ? 'success' : 'neutral'}>
                {plugin.registered
                  ? t('pluginPage.badges.registered')
                  : t('pluginPage.badges.notRegistered')}
              </StatusBadge>
              <StatusBadge tone={getEffectiveTone(plugin)}>
                {plugin.effectiveEnabled
                  ? t('pluginPage.badges.effective')
                  : t('pluginPage.badges.inactive')}
              </StatusBadge>
              <StatusBadge tone={getAuthTone(plugin)}>
                {plugin.authRequired
                  ? t('pluginPage.badges.authMayBeRequired')
                  : t('pluginPage.badges.authNotRequired')}
              </StatusBadge>
            </div>
            <div className="flex flex-wrap gap-2">
              {(plugin.installed || plugin.configured) && (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => onOpenConfig(plugin)}
                >
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  {t('pluginPage.actions.configure')}
                </Button>
              )}
              {plugin.authRequired ? (
                <Button type="button" variant="outline" size="md" onClick={onManageAuth}>
                  <KeyRound className="size-4" aria-hidden="true" />
                  {t('pluginPage.actions.manageAuth')}
                </Button>
              ) : null}
            </div>
          </section>
          <section className="grid gap-3 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">{t('pluginPage.detail.version')}</h3>
            <div className="grid gap-2 text-sm">
              <DetailRow
                label={t('pluginPage.fields.availableVersion')}
                value={formatVersion(plugin.version)}
              />
              <DetailRow
                label={t('pluginPage.fields.installedVersion')}
                value={formatVersion(plugin.installedVersion)}
              />
              <DetailRow
                label={t('pluginPage.fields.platforms')}
                value={
                  plugin.platforms.length
                    ? plugin.platforms
                        .map((platform) => `${platform.goos}/${platform.goarch}`)
                        .join(', ')
                    : ''
                }
              />
            </div>
          </section>
          <section className="grid gap-3 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">{t('pluginPage.detail.rollout')}</h3>
            {reports.length > 0 ? (
              <div className="grid gap-2">
                {reports.map((report, index) => {
                  const reportPlugin = report.plugins.find((item) => item.id === plugin.id)
                  const reportStatus = [
                    reportPlugin?.installStatus,
                    reportPlugin?.loadStatus,
                    reportPlugin?.deleteStatus,
                  ]
                    .filter(Boolean)
                    .join(' / ')

                  return (
                    <div
                      key={`${report.nodeId}-${report.clientIp}-${index}`}
                      className="rounded-md border p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          tone={report.ok === false ? 'danger' : report.ok ? 'success' : 'neutral'}
                        >
                          {report.status ?? t('pluginPage.status.unknown')}
                        </StatusBadge>
                        <span className="font-mono text-xs">
                          {report.nodeId ?? report.clientIp ?? '-'}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-2 text-xs leading-5">
                        {t('pluginPage.detail.reportMeta', {
                          phase: report.phase ?? t('pluginPage.status.unknown'),
                          time:
                            formatDateTime(report.updatedAt) ?? t('pluginPage.status.notAvailable'),
                          status: reportStatus || t('pluginPage.status.notAvailable'),
                        })}
                      </p>
                      {report.servingHome ? (
                        <p className="text-muted-foreground mt-1 text-xs leading-5">
                          {t('pluginPage.detail.reportServingHome', {
                            home: report.servingHome,
                          })}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm leading-6">
                {t('pluginPage.detail.noReports')}
              </p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

const RESERVED_PLUGIN_KEYS = new Set(['enabled', 'priority', 'load-in-home', 'store'])

function formatPluginParamValue(value: unknown): string {
  if (value === undefined) return ''
  if (typeof value === 'string' && value.trim()) {
    try {
      JSON.parse(value)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function parsePluginCustomParamValue(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return raw
  }
}

function formatDeclaredPluginValue(field: PluginConfigFieldDescriptor, value: unknown) {
  const type = field.type.trim().toLowerCase()
  if (type === 'boolean') return typeof value === 'boolean' ? value : undefined
  if (value === undefined) return undefined
  return (type === 'string' || type === 'enum') && typeof value === 'string'
    ? value
    : formatPluginParamValue(value)
}

export function PluginConfigSheet({
  plugin,
  open,
  saving,
  onClose,
  onSave,
}: {
  plugin: PluginStoreEntry | null
  open: boolean
  saving: boolean
  onClose: () => void
  onSave: (plugin: PluginStoreEntry, input: PluginConfigSaveInput) => Promise<void>
}) {
  const { t } = useTranslation()
  const configQuery = usePluginConfig(plugin?.id ?? null, open && Boolean(plugin))
  const [enabled, setEnabled] = useState(true)
  const [priority, setPriority] = useState('0')
  const [loadInHome, setLoadInHome] = useState(false)
  const [declaredValues, setDeclaredValues] = useState<
    Record<string, string | boolean | undefined>
  >({})
  const [customEntries, setCustomEntries] = useState<Array<{ key: string; value: string }>>([])
  const [baselineKeys, setBaselineKeys] = useState<string[]>([])
  const [fields, setFields] = useState<PluginConfigFieldDescriptor[]>([])
  const [localError, setLocalError] = useState<string | null>(null)
  const [readyFor, setReadyFor] = useState<string | null>(null)
  const baselineConfig = useRef<Record<string, unknown>>({})
  const ready = readyFor === configQuery.sessionKey

  useEffect(() => {
    if (!open || !plugin) {
      setReadyFor(null)
      return
    }
    if (ready || configQuery.isFetching || configQuery.errorMessage || !configQuery.config) return
    const cfg = configQuery.config
    baselineConfig.current = cfg
    setFields(configQuery.fields)
    setEnabled(typeof cfg.enabled === 'boolean' ? cfg.enabled : plugin.enabled !== false)
    setPriority(
      typeof cfg.priority === 'number' && Number.isFinite(cfg.priority)
        ? String(cfg.priority)
        : '0',
    )
    setLoadInHome(cfg['load-in-home'] === true)

    const declaredFieldNames = new Set(configQuery.fields.map((field) => field.name))
    const nextDeclared: Record<string, string | boolean | undefined> = {}
    for (const field of configQuery.fields) {
      nextDeclared[field.name] = formatDeclaredPluginValue(field, cfg[field.name])
    }
    setDeclaredValues(nextDeclared)

    const custom: Array<{ key: string; value: string }> = []
    const existingParamKeys: string[] = []
    for (const [key, value] of Object.entries(cfg)) {
      if (RESERVED_PLUGIN_KEYS.has(key)) continue
      existingParamKeys.push(key)
      if (declaredFieldNames.has(key)) continue
      custom.push({ key, value: formatPluginParamValue(value) })
    }
    setCustomEntries(custom)
    setBaselineKeys(existingParamKeys)
    setLocalError(null)
    setReadyFor(configQuery.sessionKey)
  }, [
    configQuery.config,
    configQuery.fields,
    configQuery.isFetching,
    configQuery.errorMessage,
    configQuery.sessionKey,
    open,
    plugin,
    ready,
  ])

  if (!plugin) return null

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!ready || saving) return
    setLocalError(null)

    const priorityText = priority.trim()
    if (
      priorityText &&
      (!/^-?\d+$/.test(priorityText) || !Number.isSafeInteger(Number(priorityText)))
    ) {
      setLocalError(t('pluginPage.config.validation.priorityInvalid'))
      return
    }

    const params: Record<string, unknown> = {}
    for (const field of fields) {
      const fieldType = field.type.trim().toLowerCase()
      const rawValue = declaredValues[field.name]
      const original = baselineConfig.current[field.name]
      if (rawValue === formatDeclaredPluginValue(field, original)) {
        if (Object.prototype.hasOwnProperty.call(baselineConfig.current, field.name)) {
          params[field.name] = original
        }
        continue
      }
      if (rawValue === undefined) continue
      if (fieldType === 'boolean') {
        params[field.name] = rawValue === true
        continue
      }
      const text = typeof rawValue === 'string' ? rawValue.trim() : ''
      if (!text) continue
      if (fieldType === 'integer') {
        if (!/^-?\d+$/.test(text) || !Number.isSafeInteger(Number(text))) {
          setLocalError(t('pluginPage.config.validation.paramInvalid', { name: field.name }))
          return
        }
        params[field.name] = Number(text)
      } else if (fieldType === 'number') {
        const parsed = Number(text)
        if (!Number.isFinite(parsed)) {
          setLocalError(t('pluginPage.config.validation.paramInvalid', { name: field.name }))
          return
        }
        params[field.name] = parsed
      } else if (fieldType === 'array' || fieldType === 'object') {
        try {
          const parsed: unknown = JSON.parse(text)
          if (
            fieldType === 'array'
              ? !Array.isArray(parsed)
              : !parsed || typeof parsed !== 'object' || Array.isArray(parsed)
          ) {
            throw new Error('Invalid parameter type')
          }
          params[field.name] = parsed
        } catch {
          setLocalError(t('pluginPage.config.validation.paramInvalid', { name: field.name }))
          return
        }
      } else {
        params[field.name] = rawValue
      }
    }

    for (const entry of customEntries) {
      const key = entry.key.trim()
      if (!key && entry.value.trim()) {
        setLocalError(t('pluginPage.config.validation.keyRequired'))
        return
      }
      if (!key) continue
      if (RESERVED_PLUGIN_KEYS.has(key)) {
        setLocalError(t('pluginPage.config.validation.reservedKey', { name: key }))
        return
      }
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        setLocalError(t('pluginPage.config.validation.duplicateKey', { name: key }))
        return
      }
      params[key] = parsePluginCustomParamValue(entry.value)
    }

    const removedKeys = baselineKeys.filter(
      (key) => !Object.prototype.hasOwnProperty.call(params, key),
    )

    try {
      await onSave(plugin, {
        enabled,
        priority: priorityText ? Number(priorityText) : 0,
        loadInHome,
        params,
        removedKeys,
      })
      toast.success(t('pluginPage.config.saved', { name: getPluginTitle(plugin) }))
      onClose()
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && !saving && onClose()}>
      <DrawerScaffoldContent className="sm:max-w-xl">
        <DrawerScaffoldHeader>
          <SheetTitle>{t('pluginPage.config.title', { name: getPluginTitle(plugin) })}</SheetTitle>
          <SheetDescription className="font-mono text-xs">{plugin.id}</SheetDescription>
        </DrawerScaffoldHeader>
        <DrawerScaffoldForm onSubmit={(event) => void handleSubmit(event)}>
          <DrawerScaffoldBody className="grid gap-4">
            {!ready && configQuery.errorMessage ? (
              <div className="grid gap-3" role="alert">
                <p className="text-destructive text-sm">{configQuery.errorMessage}</p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={configQuery.isFetching}
                  onClick={() => void configQuery.refetch()}
                >
                  {t('pluginPage.actions.refresh')}
                </Button>
              </div>
            ) : !ready ? (
              <div className="grid gap-3" role="status" aria-label={t('pluginPage.config.loading')}>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <>
                <div className="bg-muted/35 flex items-start justify-between gap-4 rounded-md border px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t('pluginPage.config.enabledLabel')}</p>
                    <p className="text-muted-foreground mt-1 text-xs leading-5">
                      {t('pluginPage.config.enabledDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={enabled}
                    disabled={saving}
                    onCheckedChange={setEnabled}
                    aria-label={t('pluginPage.config.enabledLabel')}
                  />
                </div>

                <label className={fieldClassName}>
                  <span>{t('pluginPage.config.priorityLabel')}</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={priority}
                    placeholder="0"
                    disabled={saving}
                    onChange={(event) => setPriority(event.target.value)}
                  />
                  <span className="text-muted-foreground text-xs leading-5 font-normal">
                    {t('pluginPage.config.priorityDescription')}
                  </span>
                </label>

                <div className="bg-muted/35 flex items-start justify-between gap-4 rounded-md border px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t('pluginPage.config.loadInHomeLabel')}</p>
                    <p className="text-muted-foreground mt-1 text-xs leading-5">
                      {t('pluginPage.config.loadInHomeDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={loadInHome}
                    disabled={saving}
                    onCheckedChange={setLoadInHome}
                    aria-label={t('pluginPage.config.loadInHomeLabel')}
                  />
                </div>

                {fields.length > 0 ? (
                  <div className="grid gap-3 rounded-md border p-3">
                    <h3 className="text-sm font-medium">
                      {t('pluginPage.config.declaredFieldsTitle')}
                    </h3>
                    {fields.map((field: PluginConfigFieldDescriptor) => {
                      const fieldType = field.type.trim().toLowerCase()
                      if (fieldType === 'boolean') {
                        return (
                          <div key={field.name} className={fieldClassName}>
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-medium">{field.name}</p>
                              {field.description ? (
                                <p className="text-muted-foreground mt-1 text-xs leading-5">
                                  {field.description}
                                </p>
                              ) : null}
                            </div>
                            <Select
                              value={
                                declaredValues[field.name] === undefined
                                  ? 'unset'
                                  : String(declaredValues[field.name])
                              }
                              disabled={saving}
                              onValueChange={(value) =>
                                setDeclaredValues((current) => ({
                                  ...current,
                                  [field.name]: value === 'unset' ? undefined : value === 'true',
                                }))
                              }
                            >
                              <SelectTrigger aria-label={field.name}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unset">
                                  {t('pluginPage.config.useDefault')}
                                </SelectItem>
                                <SelectItem value="true">true</SelectItem>
                                <SelectItem value="false">false</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )
                      }
                      if (fieldType === 'enum' && field.enumValues.length > 0) {
                        return (
                          <div key={field.name} className={fieldClassName}>
                            <span className="font-mono text-xs">{field.name}</span>
                            <Select
                              value={
                                declaredValues[field.name] === undefined
                                  ? 'unset'
                                  : `value:${declaredValues[field.name]}`
                              }
                              disabled={saving}
                              onValueChange={(val) =>
                                setDeclaredValues((current) => ({
                                  ...current,
                                  [field.name]: val === 'unset' ? undefined : val.slice(6),
                                }))
                              }
                            >
                              <SelectTrigger aria-label={field.name}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unset">
                                  {t('pluginPage.config.useDefault')}
                                </SelectItem>
                                {field.enumValues.map((opt) => (
                                  <SelectItem key={opt} value={`value:${opt}`}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {field.description ? (
                              <span className="text-muted-foreground text-xs leading-5 font-normal">
                                {field.description}
                              </span>
                            ) : null}
                          </div>
                        )
                      }
                      return (
                        <label key={field.name} className={fieldClassName}>
                          <span className="font-mono text-xs">{field.name}</span>
                          <Input
                            value={String(declaredValues[field.name] ?? '')}
                            disabled={saving}
                            className="font-mono text-xs"
                            onChange={(event) =>
                              setDeclaredValues((current) => ({
                                ...current,
                                [field.name]: event.target.value,
                              }))
                            }
                          />
                          {field.description ? (
                            <span className="text-muted-foreground text-xs leading-5 font-normal">
                              {field.description}
                            </span>
                          ) : null}
                        </label>
                      )
                    })}
                  </div>
                ) : null}

                <div className="grid gap-2.5 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {t('pluginPage.config.customParamsTitle')}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                        {t('pluginPage.config.customParamsDescription')}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() =>
                        setCustomEntries((current) => [...current, { key: '', value: '' }])
                      }
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      {t('pluginPage.config.addParam')}
                    </Button>
                  </div>
                  {customEntries.length > 0 ? (
                    <div className="grid gap-2">
                      {customEntries.map((entry, idx) => (
                        <div
                          key={idx}
                          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center"
                        >
                          <Input
                            value={entry.key}
                            placeholder="option-key"
                            disabled={saving}
                            className="font-mono text-xs"
                            onChange={(event) =>
                              setCustomEntries((current) =>
                                current.map((item, i) =>
                                  i === idx ? { ...item, key: event.target.value } : item,
                                ),
                              )
                            }
                          />
                          <Input
                            value={entry.value}
                            placeholder={t('pluginPage.config.paramValuePlaceholder')}
                            disabled={saving}
                            className="font-mono text-xs"
                            onChange={(event) =>
                              setCustomEntries((current) =>
                                current.map((item, i) =>
                                  i === idx ? { ...item, value: event.target.value } : item,
                                ),
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-md"
                            disabled={saving}
                            aria-label={t('pluginPage.config.removeParam')}
                            onClick={() =>
                              setCustomEntries((current) => current.filter((_, i) => i !== idx))
                            }
                          >
                            <X className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {localError || configQuery.errorMessage ? (
                  <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
                    {localError ?? configQuery.errorMessage}
                  </div>
                ) : null}
              </>
            )}
          </DrawerScaffoldBody>
          <DrawerScaffoldFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving || !ready}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {t('pluginPage.config.save')}
            </Button>
          </DrawerScaffoldFooter>
        </DrawerScaffoldForm>
      </DrawerScaffoldContent>
    </Sheet>
  )
}

function DetailRow({ label, value, href }: { label: string; value: string; href?: string }) {
  const { t } = useTranslation()
  const displayValue = value || t('pluginPage.status.notAvailable')

  return (
    <div className="grid gap-1 sm:grid-cols-[150px_minmax(0,1fr)]">
      <span className="text-muted-foreground text-xs">{label}</span>
      {href ? (
        <a
          className="text-primary inline-flex min-w-0 items-center gap-1 break-all hover:underline"
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          {displayValue}
          <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
        </a>
      ) : (
        <span className="min-w-0 break-all">{displayValue}</span>
      )}
    </div>
  )
}

export function PluginsWorkbenchPage() {
  const { t } = useTranslation()
  const workbench = usePluginWorkbench()
  const [selectedPlugin, setSelectedPlugin] = useState<PluginStoreEntry | null>(null)
  const [configuringPlugin, setConfiguringPlugin] = useState<PluginStoreEntry | null>(null)
  const [installTarget, setInstallTarget] = useState<PluginStoreEntry | null>(null)
  const [installVersion, setInstallVersion] = useState('')
  const [installSourceKey, setInstallSourceKey] = useState('')
  const [installError, setInstallError] = useState<string | null>(null)
  const [typedConfirmation, setTypedConfirmation] = useState('')
  const [uninstallTarget, setUninstallTarget] = useState<PluginStoreEntry | null>(null)
  const [operationNotice, setOperationNotice] = useState<PluginOperationNotice | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  /*
   * Source, version, auth and rollout are all in the detail sheet. Which plugin a
   * row is and whether it is installed and serving are what a phone keeps.
   *
   * Must stay above the disconnected/loading/error returns below: this component
   * bails out before it has a snapshot, so calling the hook further down changed
   * the hook count between renders.
   */
  const showSecondary = useSecondaryColumns()

  const selectedReports = useMemo(
    () => (selectedPlugin ? getAllPluginReports(selectedPlugin, workbench) : []),
    [selectedPlugin, workbench],
  )
  const installReports = installTarget ? getAllPluginReports(installTarget, workbench) : []
  const installIsOfficial = installTarget ? isOfficialPlugin(installTarget) : true
  const installConfirmToken = installTarget ? getConfirmToken(installTarget) : ''
  const installCanConfirm = installIsOfficial || typedConfirmation.trim() === installConfirmToken
  const installingKey = installTarget ? workbench.getPluginStateKey(installTarget) : null
  const installPending = Boolean(installingKey && workbench.installingKey === installingKey)
  const uninstallPending = Boolean(
    uninstallTarget && workbench.uninstallingId === uninstallTarget.id,
  )

  if (!workbench.connected) return <PluginsDisconnectedState />
  if (!workbench.capabilityReady || workbench.isPending) return <PluginsLoadingState />
  if (workbench.isError || !workbench.snapshot) {
    return (
      <>
        <PluginsErrorState
          kind={workbench.verdict === 'unsupported' ? 'unsupported' : 'error'}
          message={workbench.error?.message ?? null}
          onRetry={workbench.refetch}
          onManageAuth={() => setAuthOpen(true)}
        />
        <PluginStoreAuthSheet open={authOpen} onOpenChange={setAuthOpen} />
      </>
    )
  }

  const snapshot = workbench.snapshot
  const store = snapshot.store
  const installSourceCandidates = installTarget
    ? store.plugins.filter((plugin) => plugin.id === installTarget.id)
    : []
  const operationNoticePlugin = operationNotice
    ? store.plugins.find(
        (plugin) =>
          plugin.id === operationNotice.pluginId &&
          getPluginSourceKey(plugin) === operationNotice.sourceKey,
      )
    : null
  const noResults = workbench.visiblePlugins.length === 0
  const hasFilters =
    workbench.filter.trim() || workbench.statusFilter !== 'all' || workbench.sourceFilter !== 'all'

  const handleInstall = async () => {
    if (!installTarget || !installCanConfirm) return

    try {
      const { result, state } = await workbench.installPlugin(installTarget, installVersion)
      toast.success(
        t(
          installTarget.installed && installTarget.updateAvailable
            ? 'pluginPage.toast.updateStarted'
            : 'pluginPage.toast.installStarted',
          {
            name: getPluginTitle(installTarget),
          },
        ),
      )
      if (result.restartRequired) {
        toast.warning(t('pluginPage.toast.restartRequired'))
      }
      if (!result.pluginsEnabled || !state.store.pluginsEnabled) {
        toast.warning(t('pluginPage.toast.globalDisabled'))
      }
      if (state.timedOut || !state.plugin?.configured) {
        toast.warning(t('pluginPage.toast.reportPending'))
      }
      setOperationNotice({
        pluginId: installTarget.id,
        sourceKey: getPluginSourceKey(installTarget),
        name: getPluginTitle(installTarget),
        tone: state.timedOut || !state.plugin?.configured ? 'warning' : 'info',
        messageKey:
          state.timedOut || !state.plugin?.configured
            ? 'pluginPage.operationNotice.installPending'
            : 'pluginPage.operationNotice.installSynced',
      })
      setInstallTarget(null)
      setInstallVersion('')
      setInstallSourceKey('')
      setInstallError(null)
      setTypedConfirmation('')
    } catch (error) {
      const message = getErrorMessage(error)
      setInstallError(
        message.includes('plugin_store_source_required')
          ? t('pluginPage.installDialog.sourceRequiredError')
          : message,
      )
      toast.error(message)
    }
  }

  const handleUninstall = async () => {
    if (!uninstallTarget) return

    try {
      const { result, state } = await workbench.uninstallPlugin(uninstallTarget)
      toast.success(
        t('pluginPage.toast.uninstallStarted', {
          name: getPluginTitle(uninstallTarget),
        }),
      )
      if (result.restartRequired) {
        toast.warning(t('pluginPage.toast.restartRequired'))
      }
      if (state.timedOut) {
        toast.warning(t('pluginPage.toast.deletePending'))
      }
      setOperationNotice({
        pluginId: uninstallTarget.id,
        sourceKey: getPluginSourceKey(uninstallTarget),
        name: getPluginTitle(uninstallTarget),
        tone: state.timedOut ? 'warning' : 'info',
        messageKey: state.timedOut
          ? 'pluginPage.operationNotice.deletePending'
          : 'pluginPage.operationNotice.deleteSynced',
      })
      setUninstallTarget(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <section className="grid w-full gap-4">
      <PageHeader
        title={t(`pluginPage.verdict.${workbench.verdict}.title`)}
        titleMeta={
          <StatusBadge tone={verdictTone[workbench.verdict]}>
            {t(`pluginPage.verdict.${workbench.verdict}.badge`)}
          </StatusBadge>
        }
        description={t(`pluginPage.verdict.${workbench.verdict}.description`)}
        meta={
          <>
            <span>
              {t('pluginPage.header.updatedAt', {
                time: formatDateTime(store.fetchedAt) ?? store.fetchedAt,
              })}
            </span>
            <span>
              {t('pluginPage.header.nodes', {
                status:
                  workbench.capabilities.topology || workbench.capabilities.nodes
                    ? t('pluginPage.status.available')
                    : t('pluginPage.status.notAvailable'),
              })}
            </span>
          </>
        }
        tags={
          <>
            <StatusBadge tone={store.pluginsEnabled ? 'success' : 'warning'}>
              {store.pluginsEnabled
                ? t('pluginPage.badges.globalEnabled')
                : t('pluginPage.badges.globalDisabled')}
            </StatusBadge>
            {snapshot.nodeReports?.pluginReportRequired ? (
              <StatusBadge tone="info">{t('pluginPage.badges.reportRequired')}</StatusBadge>
            ) : null}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setAuthOpen(true)}>
              <KeyRound className="size-4" aria-hidden="true" />
              {t('pluginPage.actions.manageAuth')}
            </Button>
            <Button variant="outline" disabled={workbench.isFetching} onClick={workbench.refetch}>
              {workbench.isFetching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              {workbench.isFetching
                ? t('pluginPage.actions.syncing')
                : t('pluginPage.actions.refresh')}
            </Button>
          </div>
        }
      />

      {store.sourceErrors.length > 0 ? (
        <div className="border-warning/35 bg-warning/10 text-warning-foreground dark:text-warning rounded-lg border p-4 text-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="grid gap-1">
              <p className="font-medium">{t('pluginPage.sourceErrors.title')}</p>
              {store.sourceErrors.map((error, index) => (
                <p key={`${error.sourceId}-${index}`} className="text-xs leading-5">
                  {(error.sourceName || error.sourceId || error.sourceUrl) ??
                    t('pluginPage.status.unknown')}
                  {error.message ? `: ${error.message}` : null}
                </p>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {snapshot.nodeReportError ? (
        <div className="border-info/30 bg-info/10 text-info rounded-lg border p-4 text-sm">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              {t('pluginPage.nodeReports.partial', { message: snapshot.nodeReportError.message })}
            </p>
          </div>
        </div>
      ) : null}

      {operationNotice ? (
        <div className={cn('rounded-lg border p-4 text-sm', badgeToneStyles[operationNotice.tone])}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="font-medium">
                {t('pluginPage.operationNotice.title', { name: operationNotice.name })}
              </p>
              <p className="mt-1 text-xs leading-5">
                {t(operationNotice.messageKey, { name: operationNotice.name })}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {operationNoticePlugin ? (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setSelectedPlugin(operationNoticePlugin)}
                >
                  {t('pluginPage.actions.details')}
                </Button>
              ) : null}
              <Button variant="outline" size="md" onClick={workbench.refetch}>
                <RefreshCw className="size-4" aria-hidden="true" />
                {t('pluginPage.actions.refresh')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <PluginSummaryCard
          label={t('pluginPage.summary.global')}
          value={
            store.pluginsEnabled ? t('pluginPage.status.enabled') : t('pluginPage.status.disabled')
          }
          detail={t('pluginPage.summary.pluginsDir', { dir: store.pluginsDir })}
          tone={store.pluginsEnabled ? 'success' : 'warning'}
        />
        <PluginSummaryCard
          label={t('pluginPage.summary.available')}
          value={String(workbench.stats.available)}
          detail={t('pluginPage.summary.sources', { count: workbench.stats.sources })}
          tone="info"
        />
        <PluginSummaryCard
          label={t('pluginPage.summary.installed')}
          value={String(workbench.stats.installed)}
          detail={t('pluginPage.summary.effectiveHint')}
          tone={workbench.stats.installed > 0 ? 'success' : 'neutral'}
        />
        <PluginSummaryCard
          label={t('pluginPage.summary.updates')}
          value={String(workbench.stats.updates)}
          detail={t('pluginPage.summary.updatesHint')}
          tone={workbench.stats.updates > 0 ? 'info' : 'neutral'}
        />
        <PluginSummaryCard
          label={t('pluginPage.summary.authRequired')}
          value={String(workbench.stats.authRequired)}
          detail={t('pluginPage.summary.authHint')}
          tone={workbench.stats.authRequired > 0 ? 'warning' : 'neutral'}
        />
        <PluginSummaryCard
          label={t('pluginPage.summary.rollout')}
          value={
            snapshot.nodeReports?.pluginReportRequired
              ? t('pluginPage.status.required')
              : t('pluginPage.status.notRequired')
          }
          detail={t('pluginPage.summary.rolloutHint')}
          tone={snapshot.nodeReports?.pluginReportRequired ? 'info' : 'neutral'}
        />
      </div>

      <TableSurface>
        <TableSurfaceHeader
          title={t('pluginPage.table.title')}
          description={t('pluginPage.table.description')}
          actionsClassName="w-full md:w-auto"
          actions={
            <div className="grid w-full gap-2 md:w-auto md:grid-cols-[220px_160px_160px]">
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  className="pl-9"
                  value={workbench.filter}
                  onChange={(event) => workbench.setFilter(event.target.value)}
                  placeholder={t('pluginPage.filters.search')}
                  type="search"
                />
              </div>
              <Select
                value={workbench.statusFilter}
                onValueChange={(value) => workbench.setStatusFilter(value as PluginStatusFilter)}
              >
                <SelectTrigger aria-label={t('pluginPage.filters.status')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('pluginPage.filters.all')}</SelectItem>
                  <SelectItem value="installed">{t('pluginPage.filters.installed')}</SelectItem>
                  <SelectItem value="notInstalled">
                    {t('pluginPage.filters.notInstalled')}
                  </SelectItem>
                  <SelectItem value="updates">{t('pluginPage.filters.updates')}</SelectItem>
                  <SelectItem value="authRequired">
                    {t('pluginPage.filters.authRequired')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select value={workbench.sourceFilter} onValueChange={workbench.setSourceFilter}>
                <SelectTrigger aria-label={t('pluginPage.filters.source')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('pluginPage.filters.allSources')}</SelectItem>
                  {store.sources.map((source) => (
                    <SelectItem key={source.id || source.url} value={source.id || source.url}>
                      {source.name || source.id || source.url}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />
        <TableSurfaceContent>
          {noResults ? (
            <TableEmptyState
              className="m-0"
              kind={hasFilters ? 'filtered-empty' : 'empty'}
              title={t(hasFilters ? 'pluginPage.empty.noMatchesTitle' : 'pluginPage.empty.title')}
              description={t(
                hasFilters
                  ? 'pluginPage.empty.noMatchesDescription'
                  : 'pluginPage.empty.description',
              )}
              action={
                hasFilters ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      workbench.setFilter('')
                      workbench.setStatusFilter('all')
                      workbench.setSourceFilter('all')
                    }}
                  >
                    {t('pluginPage.actions.clearFilters')}
                  </Button>
                ) : null
              }
            />
          ) : (
            <Table
              containerClassName={cn(containedTableContainerClassName, 'rounded-md border')}
              className={cn(!showSecondary && 'table-fixed')}
            >
              <TableHeader>
                <TableRow>
                  <TableHead
                    className={cn(stickyTableHeaderClassName, showSecondary && 'min-w-[240px]')}
                  >
                    {t('pluginPage.columns.plugin')}
                  </TableHead>
                  {showSecondary ? (
                    <>
                      <TableHead className={cn(stickyTableHeaderClassName, 'min-w-[150px]')}>
                        {t('pluginPage.columns.source')}
                      </TableHead>
                      <TableHead className={cn(stickyTableHeaderClassName, 'min-w-[160px]')}>
                        {t('pluginPage.columns.version')}
                      </TableHead>
                    </>
                  ) : null}
                  <TableHead
                    className={cn(
                      stickyTableHeaderClassName,
                      showSecondary ? 'min-w-[220px]' : 'w-28',
                    )}
                  >
                    {t('pluginPage.columns.state')}
                  </TableHead>
                  {showSecondary ? (
                    <>
                      <TableHead className={cn(stickyTableHeaderClassName, 'min-w-[140px]')}>
                        {t('pluginPage.columns.auth')}
                      </TableHead>
                      <TableHead className={cn(stickyTableHeaderClassName, 'min-w-[150px]')}>
                        {t('pluginPage.columns.rollout')}
                      </TableHead>
                    </>
                  ) : null}
                  <TableHead
                    className={cn(
                      stickyTableHeaderClassName,
                      'table-sticky-action-head table-action-column-3 text-right',
                    )}
                  >
                    {t('pluginPage.columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workbench.visiblePlugins.map((plugin) => {
                  const rowKey = workbench.getPluginStateKey(plugin)
                  const isInstalling = workbench.installingKey === rowKey
                  const rowReports = getAllPluginReports(plugin, workbench)
                  const rolloutBadge = getPluginRolloutBadge(plugin, rowReports)
                  const versionText =
                    plugin.installed && plugin.installedVersion
                      ? plugin.updateAvailable && plugin.version
                        ? t('pluginPage.version.updateAvailable', {
                            from: formatVersion(plugin.installedVersion),
                            to: formatVersion(plugin.version),
                          })
                        : formatVersion(plugin.installedVersion)
                      : formatVersion(plugin.version)

                  return (
                    <TableRow key={rowKey} variant="resource">
                      <TableCell>
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md border">
                            <Package className="size-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{getPluginTitle(plugin)}</p>
                            <p className="text-muted-foreground font-mono text-xs">{plugin.id}</p>
                            {plugin.description ? (
                              <p className="text-muted-foreground mt-1 line-clamp-2 max-w-xl text-xs leading-5">
                                {plugin.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      {showSecondary ? (
                        <>
                          <TableCell>
                            <div className="grid gap-1">
                              <span>{getPluginSourceLabel(plugin) || '-'}</span>
                              <span className="text-muted-foreground font-mono text-xs">
                                {plugin.installType ? getInstallTypeLabel(plugin.installType) : '-'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs">{versionText || '-'}</span>
                          </TableCell>
                        </>
                      ) : null}
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {plugin.updateAvailable ? (
                            <StatusBadge tone="info">{t('pluginPage.badges.update')}</StatusBadge>
                          ) : null}
                          <StatusBadge tone={plugin.installed ? 'success' : 'neutral'}>
                            {plugin.installed
                              ? t('pluginPage.badges.installed')
                              : t('pluginPage.badges.notInstalled')}
                          </StatusBadge>
                          <StatusBadge tone={getEffectiveTone(plugin)}>
                            {plugin.effectiveEnabled
                              ? t('pluginPage.badges.effective')
                              : t('pluginPage.badges.inactive')}
                          </StatusBadge>
                        </div>
                      </TableCell>
                      {showSecondary ? (
                        <>
                          <TableCell>
                            <div className="grid gap-1.5">
                              <StatusBadge tone={getAuthTone(plugin)}>
                                {plugin.authRequired
                                  ? t('pluginPage.badges.authMayBeRequired')
                                  : t('pluginPage.badges.authNotRequired')}
                              </StatusBadge>
                              {plugin.authRequired ? (
                                <Button
                                  type="button"
                                  variant="link"
                                  size="xs"
                                  className="h-auto justify-start px-0"
                                  onClick={() => setAuthOpen(true)}
                                >
                                  {t('pluginPage.actions.manageAuth')}
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge tone={rolloutBadge.tone}>
                              {t(rolloutBadge.labelKey)}
                            </StatusBadge>
                          </TableCell>
                        </>
                      ) : null}
                      <TableCell className="table-sticky-action-cell table-action-column-3 text-right transition-colors">
                        {/*
                          This column was the last one still building its own
                          buttons: an outline Details next to a filled primary
                          Install, which gave the page as many primary actions as
                          it had rows and made one table look unlike every other.
                          Install keeps its weight through the icon and its
                          position, not through a fill repeated down the column.
                        */}
                        <RowActions
                          menuLabel={getPluginTitle(plugin)}
                          actions={[
                            {
                              id: 'details',
                              label: t('pluginPage.actions.details'),
                              icon: Eye,
                              onSelect: () => setSelectedPlugin(plugin),
                            },
                            (plugin.installed || plugin.configured) && {
                              id: 'configure',
                              label: t('pluginPage.actions.configure'),
                              icon: SlidersHorizontal,
                              onSelect: () => setConfiguringPlugin(plugin),
                            },
                            (!plugin.installed || plugin.updateAvailable) && {
                              id: 'install',
                              label: plugin.updateAvailable
                                ? t('pluginPage.actions.update')
                                : t('pluginPage.actions.install'),
                              icon: plugin.updateAvailable ? RefreshCw : Download,
                              busy: isInstalling,
                              disabled: isPluginInstallActionDisabled(workbench.installingKey),
                              onSelect: () => {
                                setInstallTarget(plugin)
                                setInstallVersion('')
                                setInstallSourceKey(getPluginSourceKey(plugin))
                                setInstallError(null)
                                setTypedConfirmation('')
                              },
                            },
                            plugin.installed && {
                              id: 'uninstall',
                              label: t('pluginPage.actions.uninstall'),
                              icon: Trash2,
                              tone: 'destructive',
                              disabled: Boolean(workbench.uninstallingId),
                              onSelect: () => setUninstallTarget(plugin),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </TableSurfaceContent>
      </TableSurface>

      <PluginDetailSheet
        plugin={selectedPlugin}
        reports={selectedReports}
        onClose={() => setSelectedPlugin(null)}
        onOpenConfig={(plugin) => {
          setSelectedPlugin(null)
          setConfiguringPlugin(plugin)
        }}
        onManageAuth={() => {
          setSelectedPlugin(null)
          setAuthOpen(true)
        }}
      />

      <PluginConfigSheet
        plugin={configuringPlugin}
        open={Boolean(configuringPlugin)}
        saving={Boolean(configuringPlugin && workbench.savingConfigId === configuringPlugin.id)}
        onClose={() => setConfiguringPlugin(null)}
        onSave={async (plugin, input) => {
          await workbench.savePluginConfig(plugin, input)
        }}
      />

      <PluginStoreAuthSheet open={authOpen} onOpenChange={setAuthOpen} />

      <AlertDialog
        open={Boolean(installTarget)}
        onOpenChange={(open) => {
          if (!open && !installPending) {
            setInstallTarget(null)
            setInstallVersion('')
            setInstallSourceKey('')
            setInstallError(null)
            setTypedConfirmation('')
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                installTarget?.installed && installTarget.updateAvailable
                  ? 'pluginPage.installDialog.updateTitle'
                  : 'pluginPage.installDialog.installTitle',
                { name: installTarget ? getPluginTitle(installTarget) : '' },
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('pluginPage.installDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {installTarget ? (
            <div className="grid gap-4">
              <div className="grid gap-2 rounded-md border p-3 text-sm">
                <DetailRow label={t('pluginPage.fields.pluginId')} value={installTarget.id} />
                <DetailRow
                  label={t('pluginPage.fields.source')}
                  value={getPluginSourceLabel(installTarget)}
                />
                <DetailRow
                  label={t('pluginPage.fields.repository')}
                  value={installTarget.repository}
                  href={buildRepositoryUrl(installTarget.repository)}
                />
                <DetailRow
                  label={t('pluginPage.fields.availableVersion')}
                  value={formatVersion(installTarget.version)}
                />
              </div>
              {installSourceCandidates.length > 1 ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="plugin-install-source">
                    {t('pluginPage.installDialog.sourceLabel')}
                  </label>
                  <Select
                    value={installSourceKey || getPluginSourceKey(installTarget)}
                    onValueChange={(value) => {
                      const nextTarget = installSourceCandidates.find(
                        (plugin) => getPluginSourceKey(plugin) === value,
                      )
                      if (nextTarget) {
                        setInstallTarget(nextTarget)
                        setInstallSourceKey(value)
                        setTypedConfirmation('')
                        setInstallError(null)
                      }
                    }}
                  >
                    <SelectTrigger id="plugin-install-source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {installSourceCandidates.map((plugin) => (
                        <SelectItem
                          key={getPluginSourceKey(plugin)}
                          value={getPluginSourceKey(plugin)}
                        >
                          {getPluginSourceLabel(plugin) || plugin.sourceUrl || plugin.storeId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs leading-5">
                    {t('pluginPage.installDialog.sourceHint')}
                  </p>
                </div>
              ) : null}
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="plugin-install-version">
                  {t('pluginPage.installDialog.versionLabel')}
                </label>
                <Input
                  id="plugin-install-version"
                  value={installVersion}
                  onChange={(event) => setInstallVersion(event.target.value)}
                  placeholder={
                    formatVersion(installTarget.version) || t('pluginPage.installDialog.latest')
                  }
                  disabled={installPending}
                  spellCheck={false}
                />
                <p className="text-muted-foreground text-xs leading-5">
                  {t('pluginPage.installDialog.versionHint')}
                </p>
              </div>
              {!installIsOfficial ? (
                <div className="border-warning/35 bg-warning/10 rounded-md border p-3">
                  <div className="text-warning-foreground dark:text-warning flex gap-2 text-sm font-medium">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {t('pluginPage.installDialog.thirdPartyTitle')}
                  </div>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">
                    {t('pluginPage.installDialog.thirdPartyDescription')}
                  </p>
                  <label className="mt-3 block text-sm font-medium" htmlFor="plugin-confirm-token">
                    {t('pluginPage.installDialog.confirmLabel', { token: installConfirmToken })}
                  </label>
                  <Input
                    id="plugin-confirm-token"
                    className="mt-2"
                    value={typedConfirmation}
                    onChange={(event) => setTypedConfirmation(event.target.value)}
                    disabled={installPending}
                    spellCheck={false}
                  />
                </div>
              ) : null}
              {installReports.length === 0 ? (
                <div className="border-info/30 bg-info/10 text-info rounded-md border p-3 text-sm">
                  {t('pluginPage.installDialog.reportHint')}
                </div>
              ) : null}
              {installError ? (
                <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
                  {installError}
                </div>
              ) : null}
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={installPending}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!installCanConfirm || installPending}
              onClick={(event) => {
                event.preventDefault()
                void handleInstall()
              }}
            >
              {installPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : installTarget?.installed && installTarget.updateAvailable ? (
                <RefreshCw className="size-4" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              {installTarget?.installed && installTarget.updateAvailable
                ? t('pluginPage.actions.update')
                : t('pluginPage.actions.install')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(uninstallTarget)}
        onOpenChange={(open) => {
          if (!open && !uninstallPending) setUninstallTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pluginPage.uninstallDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pluginPage.uninstallDialog.description', {
                name: uninstallTarget ? getPluginTitle(uninstallTarget) : '',
                id: uninstallTarget?.id ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="border-destructive/25 bg-destructive/10 text-destructive rounded-md border p-3 text-sm leading-6">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{t('pluginPage.uninstallDialog.warning')}</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={uninstallPending}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 text-white"
              disabled={uninstallPending}
              onClick={(event) => {
                event.preventDefault()
                void handleUninstall()
              }}
            >
              {uninstallPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CircleOff className="size-4" aria-hidden="true" />
              )}
              {t('pluginPage.actions.uninstall')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
