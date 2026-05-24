import { Link } from '@tanstack/react-router'

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Gauge,
  Info,
  KeyRound,
  KeySquare,
  Loader2,
  type LucideIcon,
  Network,
  PlugZap,
  RefreshCw,
  Route,
  ServerCog,
  Settings2,
  ShieldCheck,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ProviderLogo } from '@/components/shared/provider-logo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type {
  DashboardConfigCheck,
  DashboardMetric,
  DashboardRecommendedAction,
  DashboardTone,
} from '@/features/dashboard/dashboard-model'
import { useDashboardOverview } from '@/features/dashboard/use-dashboard-overview'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/session-store'
import { useConsoleUiStore } from '@/stores/ui-store'

type DashboardTagTone = DashboardTone

const metricIcons: Record<DashboardMetric['id'], LucideIcon> = {
  providers: KeySquare,
  credentials: ShieldCheck,
  clientKeys: KeyRound,
  nodes: ServerCog,
}

const configIcons: Record<DashboardConfigCheck['id'], LucideIcon> = {
  requestLog: Database,
  usageStatistics: Gauge,
  fileLogging: Settings2,
  debug: AlertTriangle,
  routing: Route,
}

const credentialSourceNameKeys = {
  db: 'dashboard.credentialSourceNames.db',
  database: 'dashboard.credentialSourceNames.db',
  file: 'dashboard.credentialSourceNames.file',
  memory: 'dashboard.credentialSourceNames.memory',
  unknown: 'dashboard.credentialSourceNames.unknown',
} as const

const recommendedActionIcons: Record<DashboardRecommendedAction['id'], LucideIcon> = {
  configureProviders: Network,
  addCredential: ShieldCheck,
  createClientKey: KeyRound,
  checkRouting: Route,
  reviewDebug: AlertTriangle,
  reviewDataStatus: ServerCog,
}

function toneBadgeClassName(tone: DashboardTone) {
  if (tone === 'positive') {
    return 'border-success/30 bg-success/10 text-success'
  }

  if (tone === 'info') {
    return 'border-info/30 bg-info/10 text-info dark:text-info'
  }

  if (tone === 'warning') {
    return 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
  }

  return 'border-border bg-muted text-muted-foreground'
}

function tagClassName(tone: DashboardTagTone) {
  if (tone === 'positive') {
    return 'border-success/30 bg-success/10 text-success'
  }

  if (tone === 'info') {
    return 'border-info/30 bg-info/10 text-info dark:text-info'
  }

  if (tone === 'warning') {
    return 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
  }

  return 'border-border bg-card text-foreground'
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  const { t } = useTranslation()
  const Icon = metricIcons[metric.id]
  const detailKey =
    metric.id === 'providers'
      ? 'dashboard.metrics.providers.detail'
      : metric.id === 'credentials'
        ? 'dashboard.metrics.credentials.detail'
        : metric.id === 'clientKeys'
          ? 'dashboard.metrics.clientKeys.detail'
          : 'dashboard.metrics.nodes.detail'
  const value =
    metric.value === null ? t('dashboard.status.notAvailableShort') : String(metric.value)

  return (
    <div className="bg-card min-w-0 rounded-lg border p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">
            {t(`dashboard.metrics.${metric.id}.title`)}
          </p>
          <p className="mt-1.5 truncate text-2xl font-semibold tracking-normal">{value}</p>
        </div>
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md border',
            toneBadgeClassName(metric.tone),
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>
      <p className="text-muted-foreground mt-2 min-h-5 text-xs leading-5">
        {t(detailKey, {
          count: metric.detailValue ?? metric.value ?? 0,
        })}
      </p>
    </div>
  )
}

function DashboardDisconnectedState() {
  const { t } = useTranslation()
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)
  const detectedBaseUrl = useSessionStore((state) => state.detectedBaseUrl)
  const detectedSource = useSessionStore((state) => state.detectedSource)
  const detectedEndpoint = detectedSource === 'same-origin' ? '/v0/management' : detectedBaseUrl
  const detectedEndpointLabel =
    detectedSource === 'same-origin'
      ? 'dashboard.disconnected.detectedProxyEndpoint'
      : 'dashboard.disconnected.detectedRuntime'

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-md">
              <PlugZap className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">
                {t('dashboard.disconnected.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {t('dashboard.disconnected.description')}
              </p>
              {detectedBaseUrl ? (
                <p className="text-primary mt-3 max-w-2xl text-sm leading-6">
                  {t(detectedEndpointLabel, {
                    endpoint: detectedEndpoint,
                  })}
                </p>
              ) : null}
            </div>
          </div>
          <Button className="md:shrink-0" onClick={openConnectionDialog}>
            <PlugZap className="size-4" aria-hidden="true" />
            {t('dashboard.disconnected.action')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function DashboardLoadingState() {
  return (
    <section className="grid w-full gap-4">
      <Skeleton className="h-36 rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <Skeleton className="h-[420px] rounded-lg" />
        <div className="grid gap-4">
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-44 rounded-lg" />
        </div>
      </div>
    </section>
  )
}

function DashboardErrorState({
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
                {t('dashboard.error.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {errorMessage ?? t('dashboard.error.description')}
              </p>
            </div>
          </div>
          <Button className="md:shrink-0" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {t('dashboard.error.retry')}
          </Button>
        </div>
      </div>
    </section>
  )
}

export function DashboardConsolePage() {
  const { t } = useTranslation()
  const overview = useDashboardOverview()

  if (!overview.connected) {
    return <DashboardDisconnectedState />
  }

  if (!overview.capabilityReady || overview.isPending) {
    return <DashboardLoadingState />
  }

  if (overview.isError || !overview.viewModel || !overview.snapshot) {
    return <DashboardErrorState errorMessage={overview.errorMessage} onRetry={overview.refetch} />
  }

  const { viewModel } = overview
  const HealthIcon =
    viewModel.healthSummary.tone === 'positive'
      ? CheckCircle2
      : viewModel.healthSummary.tone === 'info'
        ? Info
        : AlertTriangle

  return (
    <section className="grid w-full gap-4">
      <div className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-md border',
                toneBadgeClassName(viewModel.healthSummary.tone),
              )}
            >
              <HealthIcon className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-normal">
                {t(`dashboard.health.${viewModel.healthSummary.id}.title`)}
              </h1>
              <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-6">
                {t(`dashboard.health.${viewModel.healthSummary.id}.description`)}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-fit self-start lg:shrink-0"
            disabled={overview.isFetching}
            onClick={overview.refetch}
            aria-label={
              overview.isFetching ? t('dashboard.header.syncing') : t('dashboard.header.refresh')
            }
            title={
              overview.isFetching ? t('dashboard.header.syncing') : t('dashboard.header.refresh')
            }
          >
            {overview.isFetching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            {overview.isFetching ? t('dashboard.header.syncing') : t('dashboard.header.refresh')}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium',
              tagClassName('positive'),
            )}
          >
            {t('dashboard.header.runtime', {
              mode: t(`runtimeMode.${viewModel.runtimeMode}`),
            })}
          </span>
          <span className={cn('rounded-md border px-2.5 py-1 text-xs', tagClassName('info'))}>
            {t('dashboard.header.version', {
              version: viewModel.latestVersion ?? t('dashboard.status.unknown'),
            })}
          </span>
          <span className={cn('rounded-md border px-2.5 py-1 text-xs', tagClassName('neutral'))}>
            {t('dashboard.header.updatedAt', {
              time: formatDateTime(viewModel.fetchedAt),
            })}
          </span>
          {viewModel.capabilities.map((capability) => (
            <span
              key={capability.id}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
                capability.available ? tagClassName('positive') : tagClassName('neutral'),
              )}
            >
              {capability.available ? (
                <CheckCircle2 className="size-3" aria-hidden="true" />
              ) : (
                <span className="bg-muted-foreground size-1.5 rounded-full" aria-hidden="true" />
              )}
              {t(`dashboard.capabilityNames.${capability.id}`)}
            </span>
          ))}
        </div>

        {viewModel.recommendedActions.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-muted-foreground mr-1 text-xs font-medium">
              {t('dashboard.recommendedActions.title')}
            </span>
            {viewModel.recommendedActions.map((action) => {
              const Icon = recommendedActionIcons[action.id]

              return (
                <Button
                  key={action.id}
                  asChild
                  variant={action.tone === 'warning' ? 'warning' : 'outline'}
                  size="sm"
                  className="h-8"
                >
                  <Link to={action.to}>
                    <Icon className="size-3.5" aria-hidden="true" />
                    {t(`dashboard.recommendedActions.${action.id}`)}
                  </Link>
                </Button>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-4">
        {viewModel.metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <div className="bg-card flex min-w-0 flex-col rounded-lg border p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{t('dashboard.providers.title')}</h2>
            </div>
          </div>
          {viewModel.allProvidersEmpty ? (
            <div className="bg-muted/20 mt-3 flex min-h-[18rem] flex-col items-center justify-center rounded-md border border-dashed px-6 py-10 text-center xl:flex-1">
              <div className="bg-primary/10 text-primary border-primary/20 flex size-10 items-center justify-center rounded-md border">
                <Network className="size-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-sm font-semibold">{t('dashboard.providers.emptyTitle')}</h3>
              <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
                {t('dashboard.providers.emptyDescription')}
              </p>
              <Button asChild className="mt-5">
                <Link to="/providers">
                  <Network className="size-4" aria-hidden="true" />
                  {t('dashboard.providers.configureAction')}
                </Link>
              </Button>
              <p className="text-muted-foreground mt-3 max-w-md text-xs leading-5">
                {t('dashboard.providers.emptySupportedProviders')}
              </p>
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-md border xl:flex xl:flex-1 xl:flex-col">
              {viewModel.providerRows.map((provider) => (
                <div
                  key={provider.id}
                  className="grid min-h-16 gap-3 border-b px-3.5 py-3 text-sm last:border-b-0 md:grid-cols-[minmax(0,1fr)_72px_72px_72px] xl:flex-1 xl:items-center"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ProviderLogo providerId={provider.id} size="lg" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {t(`dashboard.providerNames.${provider.id}`)}
                      </p>
                      <p className="text-muted-foreground mt-0.5 truncate font-mono text-xs">
                        {provider.route}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {t('dashboard.providers.total')}
                    </p>
                    <p className="mt-0.5 font-medium">{provider.total}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {t('dashboard.providers.active')}
                    </p>
                    <p className="text-primary mt-0.5 font-medium">{provider.active}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {t('dashboard.providers.disabled')}
                    </p>
                    <p className="mt-0.5 font-medium">{provider.disabled}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid min-w-0 gap-3 self-start">
          <div className="bg-card rounded-lg border p-4 shadow-sm">
            <h2 className="text-base font-semibold">{t('dashboard.config.title')}</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {viewModel.configChecks.map((check) => {
                const Icon = configIcons[check.id]
                const value =
                  check.id === 'routing'
                    ? t(`configPage.routingStrategies.${check.value}`, {
                        defaultValue:
                          check.value === 'unknown' ? t('dashboard.status.unknown') : check.value,
                      })
                    : t(`dashboard.status.${check.enabled ? 'enabled' : 'disabled'}`)

                return (
                  <div
                    key={check.id}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-md border px-2.5 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate text-sm xl:text-xs 2xl:text-sm">
                        {t(`dashboard.configChecks.${check.id}`)}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-md border px-2 py-1 text-xs font-medium',
                        toneBadgeClassName(check.tone),
                      )}
                    >
                      {value}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {viewModel.dataStatusItems.length > 0 ? (
            <div className="bg-card rounded-lg border p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">{t('dashboard.issues.title')}</h2>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    {t('dashboard.issues.description')}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-md border px-2 py-1 text-xs font-medium',
                    toneBadgeClassName('warning'),
                  )}
                >
                  {viewModel.dataStatusItems.length}
                </span>
              </div>
              <div className="mt-3 grid gap-2">
                {viewModel.dataStatusItems.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">{t(item.labelKey)}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {item.kind === 'requestIssue'
                        ? t('dashboard.issues.requestFailed', {
                            status: item.status ?? t('dashboard.status.unknown'),
                          })
                        : t('dashboard.issues.unavailableCapability')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="bg-card rounded-lg border p-4 shadow-sm">
            <h2 className="text-base font-semibold">{t('dashboard.credentials.title')}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {viewModel.credentialSources.length > 0 ? (
                viewModel.credentialSources.map((source) =>
                  (() => {
                    const sourceNameKey =
                      credentialSourceNameKeys[
                        source.source.trim().toLowerCase() as keyof typeof credentialSourceNameKeys
                      ]

                    return (
                      <span
                        key={source.source}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs',
                          tagClassName('info'),
                        )}
                      >
                        <span>{sourceNameKey ? t(sourceNameKey) : source.source}</span>
                        <span className="text-foreground font-medium">{source.total}</span>
                      </span>
                    )
                  })(),
                )
              ) : (
                <span className="text-muted-foreground rounded-md border px-2.5 py-2 text-xs">
                  {t('dashboard.credentials.empty')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
