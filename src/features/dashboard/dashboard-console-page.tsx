import { type FocusEvent, type PointerEvent, useState } from 'react'

import { Link } from '@tanstack/react-router'

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CirclePile,
  Database,
  Eye,
  Gauge,
  HeartPulse,
  Info,
  KeyRound,
  KeySquare,
  Loader2,
  type LucideIcon,
  Network,
  PlugZap,
  RefreshCw,
  Route,
  Send,
  ServerCog,
  Settings2,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ProviderLogo } from '@/components/shared/provider-logo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type {
  DashboardConfigCheck,
  DashboardDataStatusItem,
  DashboardKeyStatusSummary,
  DashboardMetric,
  DashboardModelUsageSummary,
  DashboardOperatingKpi,
  DashboardRankPreviewItem,
  DashboardRecommendedAction,
  DashboardTone,
  DashboardUsageActivitySummary,
  DashboardUsageConsumptionTrendSummary,
} from '@/features/dashboard/dashboard-model'
import { useDashboardOverview } from '@/features/dashboard/use-dashboard-overview'
import {
  CAN_CUSTOMIZE_MANAGEMENT_ENDPOINT,
  SAME_ORIGIN_MANAGEMENT_BASE_URL,
} from '@/lib/api/management/client'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/session-store'
import { useConsoleUiStore } from '@/stores/ui-store'

type DashboardTagTone = DashboardTone
type DashboardLinkTarget =
  | '/admin/providers'
  | '/admin/credentials'
  | '/admin/access-keys'
  | '/admin/system-nodes'
  | '/admin/usage'
  | '/admin/diagnostics'
  | '/admin/logs'
  | '/admin/config'
  | '/admin/users'

const metricIcons: Record<DashboardMetric['id'], LucideIcon> = {
  providers: KeySquare,
  credentials: ShieldCheck,
  clientKeys: KeyRound,
  nodes: ServerCog,
}

const operatingKpiIcons: Record<DashboardOperatingKpi['id'], LucideIcon> = {
  tokens: CirclePile,
  requests: Send,
  successRate: HeartPulse,
  activeClientKeys: KeyRound,
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
  reviewModelServices: Network,
  reviewCredentials: ShieldCheck,
  createClientKey: KeyRound,
  checkRouting: Route,
  reviewDebug: AlertTriangle,
  reviewDataStatus: ServerCog,
}

const metricLinkTargets: Record<DashboardMetric['id'], DashboardLinkTarget> = {
  providers: '/admin/providers',
  credentials: '/admin/credentials',
  clientKeys: '/admin/access-keys',
  nodes: '/admin/system-nodes',
}

const operatingKpiLinkTargets: Record<DashboardOperatingKpi['id'], DashboardLinkTarget> = {
  tokens: '/admin/usage',
  requests: '/admin/usage',
  successRate: '/admin/diagnostics',
  activeClientKeys: '/admin/usage',
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

function neutralIconShellClassName() {
  return 'border-border bg-muted/35 text-muted-foreground'
}

function interactiveCardClassName() {
  return 'group/card transition-colors hover:border-primary/35 hover:bg-accent/35 focus-visible:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
}

function cornerDrillDownClassName() {
  return 'text-muted-foreground/60 border-transparent bg-background/70 absolute right-3 bottom-3 inline-flex size-7 items-center justify-center rounded-md border opacity-70 transition-all duration-200 sm:opacity-0 group-hover/card:border-primary/20 group-hover/card:bg-primary/10 group-hover/card:text-primary group-hover/card:opacity-100 group-focus-visible/card:border-primary/20 group-focus-visible/card:bg-primary/10 group-focus-visible/card:text-primary group-focus-visible/card:opacity-100 group-focus-within/card:border-primary/20 group-focus-within/card:bg-primary/10 group-focus-within/card:text-primary group-focus-within/card:opacity-100 dark:bg-background/40 motion-reduce:transition-none'
}

function DashboardDrillDownLink({ label, to }: { label: string; to: DashboardLinkTarget }) {
  return (
    <Link
      to={to}
      className={cn(
        'group/link focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]',
        cornerDrillDownClassName(),
      )}
      aria-label={label}
      title={label}
    >
      <Eye
        className="size-3.5 transition-transform duration-200 group-hover/link:scale-110 group-focus-visible/link:scale-110 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </Link>
  )
}

function DashboardDrillDownIndicator() {
  return (
    <span className={cn('pointer-events-none', cornerDrillDownClassName())} aria-hidden="true">
      <Eye className="size-3.5" aria-hidden="true" />
    </span>
  )
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

function getDataStatusTarget(item: DashboardDataStatusItem): DashboardLinkTarget | null {
  const id = item.id.toLowerCase()

  if (
    id.includes('gemini') ||
    id.includes('claude') ||
    id.includes('codex') ||
    id.includes('vertex') ||
    id.includes('openaicompatibility') ||
    id.includes('providers')
  ) {
    return '/admin/providers'
  }

  if (id.includes('authfiles') || id.includes('credentials')) return '/admin/credentials'
  if (id.includes('clientkeys')) return '/admin/access-keys'
  if (id.includes('nodes')) return '/admin/system-nodes'
  if (id.includes('usage')) return '/admin/usage'
  if (id.includes('logs') || id.includes('requesterrorlogs')) return '/admin/logs'
  if (id.includes('users') || id.includes('accessgroups')) return '/admin/users'
  if (id.includes('config') || id.includes('debug') || id.includes('routing')) {
    return '/admin/config'
  }

  return null
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value >= 1000 ? 1 : 0,
    notation: value >= 10_000 ? 'compact' : 'standard',
  }).format(value)
}

function formatPercent(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: value < 0.01 && value > 0 ? 2 : 1,
  }).format(value)
}

function formatOperatingKpiValue(kpi: DashboardOperatingKpi, fallback: string) {
  if (kpi.value === null) return fallback
  if (kpi.format === 'percent') return formatPercent(kpi.value)
  if (kpi.format === 'compact') return formatCompactNumber(kpi.value)
  return formatNumber(kpi.value)
}

function formatOperatingKpiDetailValue(kpi: DashboardOperatingKpi) {
  if (kpi.detailValue === null || kpi.detailValue === undefined) return null
  if (kpi.id === 'successRate') return formatPercent(kpi.detailValue)
  return formatNumber(kpi.detailValue)
}

function formatShortDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function OperatingKpiCard({ kpi, to }: { kpi: DashboardOperatingKpi; to?: DashboardLinkTarget }) {
  const { t } = useTranslation()
  const Icon = operatingKpiIcons[kpi.id]
  const value = formatOperatingKpiValue(kpi, '--')
  const detailValue = formatOperatingKpiDetailValue(kpi)
  const title = t(`dashboard.operatingKpis.${kpi.id}.title`)
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">{title}</p>
          <p className="mt-1.5 truncate text-2xl font-semibold tracking-normal tabular-nums">
            {value}
          </p>
        </div>
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md border',
            neutralIconShellClassName(),
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>
      <p className="text-muted-foreground mt-2 min-h-5 truncate pr-8 text-xs leading-5">
        <span className="min-w-0 truncate">
          {detailValue
            ? t(`dashboard.operatingKpis.${kpi.id}.detail`, { value: detailValue })
            : t(`dashboard.operatingKpis.${kpi.id}.unavailable`)}
        </span>
      </p>
      {to ? <DashboardDrillDownIndicator /> : null}
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className={cn(
          'bg-card relative block min-w-0 rounded-lg border p-3.5 pb-10 shadow-sm',
          interactiveCardClassName(),
        )}
        aria-label={t('dashboard.drillDown.open', { title })}
      >
        {content}
      </Link>
    )
  }

  return <div className="bg-card min-w-0 rounded-lg border p-3.5 shadow-sm">{content}</div>
}

function MetricCard({ metric, to }: { metric: DashboardMetric; to?: DashboardLinkTarget }) {
  const { t } = useTranslation()
  const Icon = metricIcons[metric.id]
  const detailKey =
    metric.detailKey ??
    (metric.id === 'providers'
      ? 'dashboard.metrics.providers.detail'
      : metric.id === 'credentials'
        ? 'dashboard.metrics.credentials.detail'
        : metric.id === 'clientKeys'
          ? 'dashboard.metrics.clientKeys.detail'
          : 'dashboard.metrics.nodes.detail')
  const value =
    metric.value === null ? t('dashboard.status.notAvailableShort') : String(metric.value)
  const title = t(`dashboard.metrics.${metric.id}.title`)
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">{title}</p>
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
      <p className="text-muted-foreground mt-2 min-h-5 truncate pr-8 text-xs leading-5">
        <span className="min-w-0 truncate">
          {t(detailKey, {
            count: metric.detailValue ?? metric.value ?? 0,
          })}
        </span>
      </p>
      {to ? <DashboardDrillDownIndicator /> : null}
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className={cn(
          'bg-card relative block min-w-0 rounded-lg border p-3.5 pb-10 shadow-sm',
          interactiveCardClassName(),
        )}
        aria-label={t('dashboard.drillDown.open', { title })}
      >
        {content}
      </Link>
    )
  }

  return <div className="bg-card min-w-0 rounded-lg border p-3.5 shadow-sm">{content}</div>
}

const rankDotClassNames = [
  'bg-primary',
  'bg-info',
  'bg-success',
  'bg-warning',
  'bg-muted-foreground',
] as const

function rankToneDotClassName(index: number) {
  return rankDotClassNames[index % rankDotClassNames.length]
}

function RankPreviewList({
  emptyLabel,
  items,
}: {
  emptyLabel: string
  items: DashboardRankPreviewItem[]
}) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      {items.map((item, index) => (
        <div key={item.id} className="flex min-w-0 items-center justify-between gap-3 text-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="text-muted-foreground w-4 shrink-0 text-xs tabular-nums">
              {index + 1}
            </span>
            <span
              className={cn('size-2 shrink-0 rounded-full', rankToneDotClassName(index))}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="truncate font-medium">{item.label}</p>
              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                {t('dashboard.rankPreview.requestsTokens', {
                  requests: formatNumber(item.requestCount),
                  tokens: formatCompactNumber(item.totalTokens),
                })}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-xs font-semibold tabular-nums">
              {formatPercent(item.successRate)}
            </p>
            {item.failedCount > 0 ? (
              <p className="text-warning text-xs">
                {t('dashboard.rankPreview.failed', { count: formatNumber(item.failedCount) })}
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function DashboardUsageInsightPanel({
  keyStatus,
  modelUsage,
}: {
  keyStatus: DashboardKeyStatusSummary
  modelUsage: DashboardModelUsageSummary
}) {
  const { t } = useTranslation()

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <section className="group/card bg-card relative min-w-0 rounded-lg border p-4 pb-12 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <KeyRound className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              <h2 className="text-base font-semibold">{t('dashboard.keyStatus.title')}</h2>
            </div>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {keyStatus.activeCount === null
                ? t('dashboard.keyStatus.unavailable', {
                    total: formatNumber(keyStatus.totalConfigured),
                  })
                : t('dashboard.keyStatus.summary', {
                    active: formatNumber(keyStatus.activeCount),
                    quiet: formatNumber(keyStatus.quietCount ?? 0),
                    total: formatNumber(keyStatus.totalConfigured),
                  })}
            </p>
          </div>
          <DashboardDrillDownLink to="/admin/usage" label={t('dashboard.keyStatus.action')} />
        </div>
        <RankPreviewList
          items={keyStatus.topClientKeys}
          emptyLabel={t('dashboard.keyStatus.emptyTop')}
        />
      </section>

      <section className="group/card bg-card relative min-w-0 rounded-lg border p-4 pb-12 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <TrendingUp className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              <h2 className="text-base font-semibold">{t('dashboard.modelUsage.title')}</h2>
            </div>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {modelUsage.activeCount === null
                ? t('dashboard.modelUsage.unavailable')
                : t('dashboard.modelUsage.summary', {
                    count: formatNumber(modelUsage.activeCount),
                  })}
            </p>
          </div>
          <DashboardDrillDownLink to="/admin/usage" label={t('dashboard.modelUsage.action')} />
        </div>
        <RankPreviewList
          items={modelUsage.topModels}
          emptyLabel={t('dashboard.modelUsage.emptyTop')}
        />
      </section>
    </div>
  )
}

function DashboardUsageConsumptionTrendPanel({
  summary,
}: {
  summary: DashboardUsageConsumptionTrendSummary
}) {
  const { t } = useTranslation()
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null)
  const width = 960
  const height = 192
  const margin = { top: 16, right: 18, bottom: 22, left: 18 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom
  const tokenValues = summary.points.map((point) => point.tokens)
  const maxTokens = Math.max(...tokenValues, 1)
  const getX = (index: number) =>
    margin.left + (index / Math.max(1, summary.points.length - 1)) * innerWidth
  const getY = (tokens: number) => margin.top + innerHeight - (tokens / maxTokens) * innerHeight
  const chartPoints = summary.points.map((point, index) => ({
    ...point,
    x: getX(index),
    y: getY(point.tokens),
  }))
  const linePoints = chartPoints.map((point) => `${point.x},${point.y}`)
  const areaPath =
    linePoints.length > 0
      ? `M ${linePoints.join(' L ')} L ${margin.left + innerWidth},${margin.top + innerHeight} L ${
          margin.left
        },${margin.top + innerHeight} Z`
      : ''
  const labelIndexes = [
    ...new Set([0, Math.floor(summary.points.length / 2), summary.points.length - 1]),
  ].filter((index) => index >= 0 && index < summary.points.length)
  const activePoint =
    activePointIndex === null ? null : (chartPoints[activePointIndex] ?? chartPoints[0])
  const tooltipWidth = 196
  const tooltipHeight = 76
  const tooltipGap = 10
  const tooltipX = activePoint
    ? Math.min(
        Math.max(activePoint.x - tooltipWidth / 2, margin.left),
        width - margin.right - tooltipWidth,
      )
    : 0
  const tooltipY = activePoint
    ? activePoint.y > tooltipHeight + tooltipGap + margin.top
      ? activePoint.y - tooltipHeight - tooltipGap
      : activePoint.y + tooltipGap
    : 0

  function updateActivePoint(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const pointerX = ((event.clientX - rect.left) / rect.width) * width
    const clampedX = Math.min(Math.max(pointerX, margin.left), margin.left + innerWidth)
    const nextIndex = chartPoints.reduce(
      (nearestIndex, point, index) => {
        const distance = Math.abs(point.x - clampedX)
        return distance < nearestIndex.distance ? { index, distance } : nearestIndex
      },
      { index: 0, distance: Number.POSITIVE_INFINITY },
    ).index

    setActivePointIndex(nextIndex)
  }

  function clearActivePoint(event: FocusEvent<SVGCircleElement>) {
    if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
      setActivePointIndex(null)
    }
  }

  return (
    <div className="group/card bg-card relative h-full min-w-0 rounded-lg border p-4 pb-12 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <Gauge className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <h2 className="min-w-0 truncate text-base font-semibold">
              {t('dashboard.usageConsumptionTrend.title')}
            </h2>
          </div>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-6">
            {t('dashboard.usageConsumptionTrend.description')}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('dashboard.usageConsumptionTrend.summary', {
              buckets: formatNumber(summary.bucketCount),
              tokens: formatCompactNumber(summary.totalTokens),
            })}
          </p>
        </div>
        <DashboardDrillDownLink
          to="/admin/usage"
          label={t('dashboard.usageConsumptionTrend.action')}
        />
      </div>
      <div className="mt-4 min-w-0 overflow-x-auto pb-1">
        <div className="min-w-[560px]">
          <div style={{ aspectRatio: `${width} / ${height}` }}>
            <svg
              className="block size-full cursor-crosshair overflow-visible"
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={t('dashboard.usageConsumptionTrend.title')}
              onPointerMove={updateActivePoint}
              onPointerLeave={() => setActivePointIndex(null)}
            >
              {[0, 0.5, 1].map((tick) => {
                const y = margin.top + innerHeight - tick * innerHeight

                return (
                  <line
                    key={tick}
                    x1={margin.left}
                    x2={margin.left + innerWidth}
                    y1={y}
                    y2={y}
                    stroke="var(--border)"
                    strokeDasharray="3 4"
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}
              {areaPath ? (
                <path
                  d={areaPath}
                  fill="var(--primary)"
                  opacity="0.1"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {linePoints.length > 1 ? (
                <polyline
                  points={linePoints.join(' ')}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {chartPoints.map((point, index) => (
                <circle
                  key={point.id}
                  cx={point.x}
                  cy={point.y}
                  r="3"
                  fill="var(--card)"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  tabIndex={0}
                  vectorEffect="non-scaling-stroke"
                  aria-label={t('dashboard.usageConsumptionTrend.tooltip.pointAria', {
                    time: formatShortDateTime(point.label.split(' - ')[0] ?? point.label),
                    tokens: t('dashboard.usageConsumptionTrend.tooltip.tokenValue', {
                      value: formatCompactNumber(point.tokens),
                    }),
                    requests: formatNumber(point.requestCount),
                  })}
                  onFocus={() => setActivePointIndex(index)}
                  onBlur={clearActivePoint}
                />
              ))}
              <rect
                x={margin.left}
                y={margin.top}
                width={innerWidth}
                height={innerHeight}
                fill="transparent"
              />
              {activePoint ? (
                <g pointerEvents="none">
                  <line
                    x1={activePoint.x}
                    x2={activePoint.x}
                    y1={margin.top}
                    y2={margin.top + innerHeight}
                    stroke="var(--primary)"
                    strokeDasharray="4 5"
                    opacity="0.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={margin.left}
                    x2={margin.left + innerWidth}
                    y1={activePoint.y}
                    y2={activePoint.y}
                    stroke="var(--primary)"
                    strokeDasharray="4 5"
                    opacity="0.45"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={activePoint.x}
                    cy={activePoint.y}
                    r="5"
                    fill="var(--primary)"
                    stroke="var(--card)"
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <g transform={`translate(${tooltipX} ${tooltipY})`}>
                    <rect
                      width={tooltipWidth}
                      height={tooltipHeight}
                      rx="8"
                      fill="var(--card)"
                      stroke="var(--border)"
                      vectorEffect="non-scaling-stroke"
                    />
                    <text x="12" y="21" fill="var(--foreground)" fontSize="12" fontWeight="600">
                      {formatShortDateTime(activePoint.label.split(' - ')[0] ?? activePoint.label)}
                    </text>
                    <text x="12" y="44" fill="var(--muted-foreground)" fontSize="11">
                      {t('dashboard.usageConsumptionTrend.tooltip.tokens')}
                    </text>
                    <text
                      x={tooltipWidth - 12}
                      y="44"
                      textAnchor="end"
                      fill="var(--foreground)"
                      fontSize="11"
                    >
                      {t('dashboard.usageConsumptionTrend.tooltip.tokenValue', {
                        value: formatCompactNumber(activePoint.tokens),
                      })}
                    </text>
                    <text x="12" y="62" fill="var(--muted-foreground)" fontSize="11">
                      {t('dashboard.usageConsumptionTrend.tooltip.requests')}
                    </text>
                    <text
                      x={tooltipWidth - 12}
                      y="62"
                      textAnchor="end"
                      fill="var(--foreground)"
                      fontSize="11"
                    >
                      {formatNumber(activePoint.requestCount)}
                    </text>
                  </g>
                </g>
              ) : null}
            </svg>
          </div>
          <div className="text-muted-foreground mt-2 flex justify-between gap-3 text-xs">
            {labelIndexes.map((index) => {
              const point = summary.points[index]
              return <span key={point.id}>{formatShortDateTime(point.label.split(' - ')[0])}</span>
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function getUsageActivityBucketClassName(
  status: DashboardUsageActivitySummary['buckets'][number]['status'],
) {
  if (status === 'healthy') return 'bg-success/85'
  if (status === 'warning') return 'bg-warning/85'
  // degraded uses a light destructive hue so it is distinguishable from amber `warning`
  // for color-vision-deficient users, not just a lower-opacity warning.
  if (status === 'degraded') return 'bg-destructive/45'
  if (status === 'failed') return 'bg-destructive/85'
  return 'bg-muted'
}

function DashboardUsageActivityPanel({ summary }: { summary: DashboardUsageActivitySummary }) {
  const { t } = useTranslation()
  const bucketColumnCount = Math.max(4, Math.ceil(summary.buckets.length / 2))

  return (
    <div className="group/card bg-card relative flex h-full min-w-0 flex-col rounded-lg border p-4 pb-12 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <Activity className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <h2 className="min-w-0 truncate text-base font-semibold">
              {t('dashboard.usageActivity.title')}
            </h2>
          </div>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            {t('dashboard.usageActivity.description')}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('dashboard.usageActivity.summary', {
              buckets: formatNumber(summary.activeBucketCount),
              requests: formatNumber(summary.requestCount),
              successRate: formatPercent(summary.successRate),
            })}
          </p>
        </div>
        <DashboardDrillDownLink
          to="/admin/diagnostics"
          label={t('dashboard.usageActivity.action')}
        />
      </div>
      <div
        className="mt-5 grid gap-0.5 sm:gap-1"
        style={{
          gridTemplateColumns: `repeat(${bucketColumnCount}, minmax(0, 1fr))`,
        }}
      >
        {summary.buckets.map((bucket) => {
          const bucketTitle = t('dashboard.usageActivity.bucketTitle', {
            label: bucket.label,
            requests: formatNumber(bucket.requestCount),
            successRate: formatPercent(bucket.successRate),
          })
          return (
            <span
              key={bucket.id}
              role="img"
              aria-label={`${t(`dashboard.usageActivity.status.${bucket.status}`)} · ${bucketTitle}`}
              className={cn('h-2.5 rounded-[2px]', getUsageActivityBucketClassName(bucket.status))}
              title={bucketTitle}
            />
          )
        })}
      </div>
      <div className="text-muted-foreground mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-4 text-xs">
        {(['healthy', 'warning', 'degraded', 'failed', 'empty'] as const).map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span
              className={cn('size-2 rounded-[2px]', getUsageActivityBucketClassName(status))}
              aria-hidden="true"
            />
            {t(`dashboard.usageActivity.status.${status}`)}
          </span>
        ))}
      </div>
    </div>
  )
}

function DashboardDataStatusRow({ item }: { item: DashboardDataStatusItem }) {
  const { t } = useTranslation()
  const target = getDataStatusTarget(item)
  const StatusIcon = item.tone === 'warning' ? AlertTriangle : Info
  const content = (
    <>
      <span className="min-w-0 truncate">{t(item.labelKey)}</span>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 text-xs',
          item.tone === 'warning'
            ? 'text-warning-foreground dark:text-warning'
            : 'text-info dark:text-info',
        )}
      >
        <StatusIcon className="size-3.5" aria-hidden="true" />
        {item.kind === 'requestIssue'
          ? t('dashboard.issues.requestFailed', {
              status: item.status ?? t('dashboard.status.unknown'),
            })
          : t('dashboard.issues.unavailableCapability')}
        {target ? <ArrowRight className="size-3.5" aria-hidden="true" /> : null}
      </span>
    </>
  )

  if (target) {
    return (
      <Link
        to={target}
        className={cn(
          'flex min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm transition-colors',
          'hover:border-primary/35 hover:bg-accent/35 focus-visible:border-primary/45 focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        )}
        aria-label={t('dashboard.drillDown.openIssue', { title: t(item.labelKey) })}
      >
        {content}
      </Link>
    )
  }

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
      {content}
    </div>
  )
}

function DashboardDisconnectedState() {
  const { t } = useTranslation()
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)

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
              {CAN_CUSTOMIZE_MANAGEMENT_ENDPOINT ? <DashboardDetectedEndpoint /> : null}
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

function DashboardDetectedEndpoint() {
  const { t } = useTranslation()
  const detectedBaseUrl = useSessionStore((state) => state.detectedBaseUrl)
  const detectedSource = useSessionStore((state) => state.detectedSource)
  const detectedEndpoint =
    detectedSource === 'same-origin' ? SAME_ORIGIN_MANAGEMENT_BASE_URL : detectedBaseUrl
  const detectedEndpointLabel =
    detectedSource === 'same-origin'
      ? 'dashboard.disconnected.detectedProxyEndpoint'
      : 'dashboard.disconnected.detectedRuntime'

  if (!detectedBaseUrl) return null

  return (
    <p className="text-primary mt-3 max-w-2xl text-sm leading-6">
      {t(detectedEndpointLabel, {
        endpoint: detectedEndpoint,
      })}
    </p>
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

  if (overview.checking || (overview.connected && !overview.capabilityReady)) {
    return <DashboardLoadingState />
  }

  if (!overview.connected) {
    return <DashboardDisconnectedState />
  }

  if (overview.isPending) {
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
  const hasConfigAttention = viewModel.configChecks.some((check) => check.tone === 'warning')

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
                tagClassName(capability.tone),
              )}
            >
              {capability.tone === 'warning' ? (
                <AlertTriangle className="size-3" aria-hidden="true" />
              ) : (
                <Info className="size-3" aria-hidden="true" />
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

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-4">
        {viewModel.operatingKpis.map((kpi) => (
          <OperatingKpiCard
            key={kpi.id}
            kpi={kpi}
            to={kpi.value === null ? undefined : operatingKpiLinkTargets[kpi.id]}
          />
        ))}
      </div>

      {viewModel.usageConsumptionTrendSummary || viewModel.usageActivitySummary ? (
        <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
          {viewModel.usageConsumptionTrendSummary ? (
            <DashboardUsageConsumptionTrendPanel summary={viewModel.usageConsumptionTrendSummary} />
          ) : null}

          {viewModel.usageActivitySummary ? (
            <DashboardUsageActivityPanel summary={viewModel.usageActivitySummary} />
          ) : null}
        </div>
      ) : null}

      <DashboardUsageInsightPanel
        keyStatus={viewModel.keyStatusSummary}
        modelUsage={viewModel.modelUsageSummary}
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-4">
        {viewModel.metrics.map((metric) => (
          <MetricCard
            key={metric.id}
            metric={metric}
            to={metric.value === null ? undefined : metricLinkTargets[metric.id]}
          />
        ))}
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <div
          className={cn(
            'group/card bg-card relative flex min-w-0 flex-col rounded-lg border p-4 shadow-sm',
            !viewModel.allProvidersEmpty && 'pb-12',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{t('dashboard.providers.title')}</h2>
            </div>
            {!viewModel.allProvidersEmpty ? (
              <DashboardDrillDownLink
                to="/admin/providers"
                label={t('dashboard.providers.action')}
              />
            ) : null}
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
                <Link to="/admin/providers">
                  <Network className="size-4" aria-hidden="true" />
                  {t('dashboard.providers.configureAction')}
                </Link>
              </Button>
              <p className="text-muted-foreground mt-3 max-w-md text-xs leading-5">
                {t(
                  viewModel.runtimeMode === 'cpa'
                    ? 'dashboard.providers.emptySupportedProvidersCpa'
                    : 'dashboard.providers.emptySupportedProviders',
                )}
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

        <div className="grid min-w-0 gap-3 xl:grid-rows-[auto_1fr]">
          <div
            className={cn(
              'group/card bg-card relative flex min-h-0 flex-col rounded-lg border p-4 shadow-sm',
              hasConfigAttention && 'pb-12',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold">{t('dashboard.config.title')}</h2>
              {hasConfigAttention ? (
                <DashboardDrillDownLink to="/admin/config" label={t('dashboard.config.action')} />
              ) : null}
            </div>
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
                  <DashboardDataStatusRow key={item.id} item={item} />
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
