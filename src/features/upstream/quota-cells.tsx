import { ChevronRight, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { OverflowTooltipText } from '@/components/shared/overflow-tooltip-text'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCredentialDateTime } from '@/features/credentials/credential-display'
import {
  formatUpstreamQuotaRelativeTime,
  getUpstreamQuotaWindowDisplayLabel,
  getUpstreamQuotaWindowIdentityLabel,
} from '@/features/upstream/quota-format'
import type { QuotaPlan, QuotaStatus, QuotaWindow } from '@/lib/api/management/quota'
import { cn } from '@/lib/utils'

import { QuotaFooter } from './quota-footer'
import { resolveQuotaPlanTier } from './quota-plan-tier'
import { QuotaPreviewGrid } from './quota-preview-grid'
import { buildQuotaPreviewGrid } from './quota-preview-model'
import { QuotaQueryIssue } from './quota-query-issue'
import { QuotaTooltip, QuotaWindowTooltip } from './quota-tooltip'
import {
  type UpstreamQuotaCellState,
  type UpstreamQuotaEntry,
  findCurrencyWindow,
  findXaiOnDemandWindow,
  findXaiProductUsageWindows,
  findXaiWeeklyWindow,
  isRetainedQuotaWindow,
  resolveAntigravityQuotaPresentation,
  resolveQuotaLabelState,
  resolveQuotaSnapshotDisplay,
  resolveXaiOnDemandState,
} from './upstream-quota-model'

const upstreamQuotaProgressClassNames: Record<QuotaStatus, string> = {
  healthy: 'bg-success',
  low: 'bg-warning',
  exhausted: 'bg-destructive',
  error: 'bg-destructive',
  unknown: 'bg-muted-foreground/40',
  unsupported: 'bg-info/60',
}

const quotaWindowRowClassName =
  'grid min-w-0 grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_2.25rem] items-center gap-2'

function UpstreamQuotaPlanBadge({ provider, plan }: { provider: string; plan: QuotaPlan }) {
  const { t, i18n } = useTranslation()
  const label = t('upstreamPage.quota.summary.plan', { name: plan.name })
  const expiresAt = Date.parse(plan.expiresAt ?? '')
  const expiry = Number.isFinite(expiresAt)
    ? t('upstreamPage.quota.summary.subscriptionExpiresAt', {
        time: new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(expiresAt),
      })
    : null
  return (
    <QuotaTooltip
      content={
        <div className="grid gap-1">
          <p>{label}</p>
          {expiry ? <p>{expiry}</p> : null}
        </div>
      }
    >
      <Badge
        variant="outline"
        className="quota-plan-badge max-w-full min-w-0 shrink"
        data-plan-tier={resolveQuotaPlanTier(provider, plan)}
        aria-label={expiry ? `${label}, ${expiry}` : label}
        tabIndex={0}
      >
        <span className="min-w-0 truncate">{label}</span>
      </Badge>
    </QuotaTooltip>
  )
}

const quotaLabelMeta = {
  unsupported: {
    label: 'upstreamPage.quota.unsupported',
    hint: 'upstreamPage.quota.summary.unsupportedHint',
    variant: 'unsupported',
  },
  collecting: {
    label: 'upstreamPage.quota.summary.updating',
    hint: 'upstreamPage.quota.summary.collectingHint',
    variant: 'info',
  },
  'read-error': {
    label: 'upstreamPage.quota.summary.readFailed',
    hint: 'upstreamPage.quota.summary.readFailedHint',
    variant: 'destructive',
  },
  outdated: {
    label: 'upstreamPage.quota.summary.historical',
    hint: 'upstreamPage.quota.summary.historicalHint',
    variant: 'muted',
  },
  'not-collected': {
    label: 'upstreamPage.quota.notCollected',
    hint: 'upstreamPage.quota.summary.notCollectedHint',
    variant: 'unknown',
  },
  'no-data': {
    label: 'upstreamPage.quota.summary.noData',
    hint: 'upstreamPage.quota.summary.noDataHint',
    variant: 'unknown',
  },
  unknown: {
    label: 'upstreamPage.quota.status.unknown',
    hint: 'upstreamPage.quota.summary.unknownHint',
    variant: 'unknown',
  },
} as const

export function QuotaSnapshotBadges({
  entry,
  collecting = false,
  readFailed = false,
  unavailableReason,
}: {
  entry: UpstreamQuotaEntry
  collecting?: boolean
  readFailed?: boolean
  unavailableReason?: string
}) {
  const { t, i18n } = useTranslation()
  const state = resolveQuotaLabelState(entry, { collecting, readFailed })
  const meta = state && state !== 'failed' && state !== 'partial' ? quotaLabelMeta[state] : null
  const expiresAt = Date.parse(entry.expiresAt ?? '')
  const hint = meta
    ? [
        t(
          unavailableReason && state === 'outdated'
            ? 'upstreamPage.quota.summary.historicalReadOnlyHint'
            : unavailableReason && state === 'not-collected'
              ? 'upstreamPage.quota.summary.notCollectedReadOnlyHint'
              : meta.hint,
          { action: t('upstreamPage.quota.actions.collect') },
        ),
        state === 'outdated' && Number.isFinite(expiresAt)
          ? t('upstreamPage.quota.summary.validUntil', {
              time: new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(expiresAt),
            })
          : null,
        unavailableReason,
      ]
        .filter(Boolean)
        .join(' ')
    : ''
  if (!entry.plan && !state) return null
  return (
    <div
      role="group"
      aria-label={t('upstreamPage.quota.summary.labels')}
      className="flex min-w-0 items-center gap-1.5"
    >
      {entry.plan ? <UpstreamQuotaPlanBadge provider={entry.provider} plan={entry.plan} /> : null}
      {state ? (
        <div className={cn('min-w-0 shrink-0', entry.plan ? 'max-w-[65%]' : 'max-w-full')}>
          {state === 'failed' || state === 'partial' ? (
            <QuotaQueryIssue entry={entry} />
          ) : meta ? (
            <QuotaTooltip content={hint}>
              <Badge tabIndex={0} variant={meta.variant} className="max-w-full min-w-0">
                {state === 'collecting' ? (
                  <LoaderCircle
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : null}
                <span className="min-w-0 truncate">{t(meta.label)}</span>
              </Badge>
            </QuotaTooltip>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function formatInlineMoney(value: number | null, currency: string | null) {
  if (value === null) return null
  if (!currency) return value.toFixed(2)
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

export function InlineWindowBar({
  window,
  label,
  historical = false,
}: {
  window: QuotaWindow
  label?: string
  historical?: boolean
}) {
  const { t, i18n } = useTranslation()
  const percentage = window.remainingRatio === null ? null : Math.round(window.remainingRatio * 100)
  const periodLabel = getUpstreamQuotaWindowDisplayLabel(
    window,
    t,
    i18n.resolvedLanguage ?? i18n.language,
  )
  const identityLabel = label ? null : getUpstreamQuotaWindowIdentityLabel(window, t)
  const displayLabel = label ?? identityLabel ?? periodLabel
  const ariaLabel = identityLabel ? `${identityLabel}, ${periodLabel}` : displayLabel

  return (
    <div className="grid min-w-0 grid-cols-1 gap-1">
      <div className={quotaWindowRowClassName}>
        <div className="min-w-0 text-[11px] font-medium">
          <OverflowTooltipText
            value={displayLabel}
            overflowClassName="cursor-pointer"
            className={!identityLabel ? 'text-muted-foreground' : undefined}
            tooltipClassName="max-w-[min(24rem,calc(100vw-2rem))] whitespace-normal wrap-anywhere"
          />
          {identityLabel ? (
            <QuotaTooltip content={periodLabel}>
              <span className="text-muted-foreground block truncate text-[10px]">
                {periodLabel}
              </span>
            </QuotaTooltip>
          ) : null}
        </div>
        <QuotaWindowTooltip window={window} label={ariaLabel}>
          <div
            className="bg-muted h-1.5 overflow-hidden rounded-full"
            role="progressbar"
            aria-label={`${ariaLabel}: ${t('upstreamPage.quota.remaining')}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentage ?? undefined}
            aria-valuetext={
              percentage === null ? t('upstreamPage.quota.common.notAvailable') : undefined
            }
            aria-description={
              historical ? t('upstreamPage.quota.summary.historicalHint') : undefined
            }
          >
            {percentage === null ? null : (
              <div
                className={cn(
                  'h-full rounded-full',
                  upstreamQuotaProgressClassNames[window.status],
                )}
                style={{ width: `${percentage}%` }}
              />
            )}
          </div>
        </QuotaWindowTooltip>
        <span className="text-muted-foreground text-right text-[11px] tabular-nums">
          {percentage === null ? '—' : `${percentage}%`}
        </span>
      </div>
    </div>
  )
}

function InlineWindowMoneyLine({ window }: { window: QuotaWindow }) {
  const { t } = useTranslation()
  const remaining = formatInlineMoney(window.remaining, window.currency)
  const limit = formatInlineMoney(window.limit, window.currency)
  if (!remaining || !limit) return null

  return (
    <p className="text-muted-foreground truncate text-[11px] tabular-nums">
      {t('upstreamPage.quota.moneyRemaining', { remaining, limit })}
    </p>
  )
}

function GenericWindowsCell({ entry }: { entry: UpstreamQuotaEntry }) {
  const { t } = useTranslation()
  const windows = entry.primaryWindows.length > 0 ? entry.primaryWindows : entry.windows
  const historical = resolveQuotaSnapshotDisplay(entry).historical
  const isDevin = entry.provider.trim().toLowerCase() === 'devin'
  const grid = isDevin ? null : buildQuotaPreviewGrid(entry)
  if (grid)
    return (
      <QuotaPreviewGrid
        grid={grid}
        historical={historical}
        progressClassNames={upstreamQuotaProgressClassNames}
      />
    )
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1.5">
      {windows.slice(0, 2).map((window) => (
        <InlineWindowBar
          key={window.id}
          window={window}
          historical={historical}
          label={
            isDevin && (window.periodUnit === 'day' || window.periodUnit === 'week')
              ? t(
                  window.periodUnit === 'day'
                    ? 'upstreamPage.quota.daily'
                    : 'upstreamPage.quota.weekly',
                )
              : undefined
          }
        />
      ))}
    </div>
  )
}

function AntigravityQuotaCell({ entry }: { entry: UpstreamQuotaEntry }) {
  const { t } = useTranslation()
  const presentation = resolveAntigravityQuotaPresentation(entry, [
    ...entry.primaryWindows,
    ...entry.windows,
  ])
  const grid = buildQuotaPreviewGrid(entry)
  if (presentation.kind === 'windows' && grid) {
    return (
      <QuotaPreviewGrid
        grid={grid}
        historical={resolveQuotaSnapshotDisplay(entry).historical}
        progressClassNames={upstreamQuotaProgressClassNames}
      />
    )
  }
  return (
    <p className="text-muted-foreground text-meta">
      {presentation.kind === 'collecting'
        ? t('upstreamPage.quota.antigravity.upgrading')
        : presentation.kind === 'legacy'
          ? t('upstreamPage.quota.antigravity.legacy')
          : t('upstreamPage.quota.noWindows')}
    </p>
  )
}

function formatXaiProductUsedPercent(window: QuotaWindow): string | null {
  if (window.used !== null && Number.isFinite(window.used)) {
    return `${Math.round(Math.max(0, Math.min(100, window.used)))}%`
  }
  if (window.usedRatio !== null && Number.isFinite(window.usedRatio)) {
    return `${Math.round(Math.max(0, Math.min(100, window.usedRatio * 100)))}%`
  }
  return null
}

export function XaiProductUsageList({ entry }: { entry: UpstreamQuotaEntry }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  return (
    <div className="grid min-w-0 gap-2 wrap-anywhere tabular-nums">
      {findXaiProductUsageWindows(entry).map((window) => (
        <div key={window.id} className="grid min-w-0 gap-0.5">
          <p>
            {t('upstreamPage.quota.xai.productUsage', {
              product: window.label?.trim() || window.id.replace(/^xai-product-/, ''),
            })}
            {': '}
            {formatXaiProductUsedPercent(window) ?? t('upstreamPage.quota.xai.usageUnavailable')}
          </p>
          {isRetainedQuotaWindow(entry, window) ? (
            <time
              dateTime={window.observedAt ?? undefined}
              aria-label={formatCredentialDateTime(window.observedAt, locale) ?? undefined}
              className="text-meta"
            >
              {t('upstreamPage.quota.summary.observedAgo', {
                time: formatUpstreamQuotaRelativeTime(Date.parse(window.observedAt ?? ''), locale),
              })}
            </time>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function GrokQuotaCell({ entry }: { entry: UpstreamQuotaEntry }) {
  const { t } = useTranslation()
  const monthlyWindow = findCurrencyWindow(entry)
  const onDemandWindow = findXaiOnDemandWindow(entry)
  const weeklyWindow = findXaiWeeklyWindow(entry)
  const products = findXaiProductUsageWindows(entry)
  const onDemandState = resolveXaiOnDemandState(entry)
  const historical = resolveQuotaSnapshotDisplay(entry).historical
  const windows = [weeklyWindow, monthlyWindow, onDemandWindow]
    .filter((window): window is QuotaWindow => window !== null)
    .slice(0, 2)
  if (windows.length === 0 && products.length === 0) return <GenericWindowsCell entry={entry} />
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1.5">
      {windows.map((window) => (
        <div key={window.id} className="grid min-w-0 grid-cols-1 gap-1">
          <InlineWindowBar
            window={window}
            historical={historical}
            label={t(
              window.id === weeklyWindow?.id
                ? 'upstreamPage.quota.weekly'
                : window.id === monthlyWindow?.id
                  ? 'upstreamPage.quota.monthly'
                  : 'upstreamPage.quota.onDemand',
            )}
          />
          {window.unit === 'currency' ? <InlineWindowMoneyLine window={window} /> : null}
        </div>
      ))}
      <p className="text-muted-foreground text-meta">
        {t('upstreamPage.quota.onDemand')}:{' '}
        {t(
          onDemandState === 'enabled'
            ? 'upstreamPage.quota.onDemandEnabled'
            : onDemandState === 'disabled'
              ? 'upstreamPage.quota.onDemandDisabled'
              : 'upstreamPage.quota.onDemandUnknown',
        )}
      </p>
      {products.length > 0 ? (
        <QuotaTooltip
          content={
            <div className="grid gap-1">
              <p className="font-medium">{t('upstreamPage.quota.xai.usageBreakdown')}</p>
              <XaiProductUsageList entry={entry} />
            </div>
          }
        >
          <p tabIndex={0} className="text-muted-foreground text-meta w-fit max-w-full truncate">
            {t('upstreamPage.quota.summary.sharedProducts', { count: products.length })}
          </p>
        </QuotaTooltip>
      ) : null}
    </div>
  )
}

function QuotaPreview({ entry }: { entry: UpstreamQuotaEntry }) {
  const { t } = useTranslation()
  const provider = entry.provider.trim().toLowerCase()
  if (entry.status === 'unsupported') return null
  if (provider === 'antigravity') return <AntigravityQuotaCell entry={entry} />
  if (!resolveQuotaSnapshotDisplay(entry).hasWindows) {
    return <p className="text-muted-foreground text-meta">{t('upstreamPage.quota.noWindows')}</p>
  }
  if (provider === 'xai') return <GrokQuotaCell entry={entry} />
  return <GenericWindowsCell entry={entry} />
}

export function UpstreamQuotaCell({
  state,
  collecting = false,
  unavailableReason,
  onInspect,
  detailLoading = false,
  detailFailed = false,
}: {
  state: UpstreamQuotaCellState
  collecting?: boolean
  unavailableReason?: string
  onInspect?: () => void
  detailLoading?: boolean
  detailFailed?: boolean
}) {
  const { t } = useTranslation()
  if (state.kind === 'loading') return <Skeleton className="h-8 w-full max-w-40 rounded-md" />
  if (state.kind !== 'entry') {
    const label = t(
      state.kind === 'capability-absent'
        ? 'upstreamPage.quota.unsupported'
        : state.kind === 'read-error'
          ? 'upstreamPage.quota.summary.readFailed'
          : state.kind === 'snapshot-miss'
            ? 'upstreamPage.quota.snapshotMiss'
            : 'upstreamPage.quota.summary.recordMissing',
    )
    const hint = t(
      state.kind === 'capability-absent'
        ? 'upstreamPage.quota.summary.capabilityAbsentHint'
        : state.kind === 'read-error'
          ? 'upstreamPage.quota.summary.readFailedHint'
          : 'upstreamPage.quota.summary.recordMissingHint',
    )
    return (
      <div className="flex min-w-0 items-center justify-between gap-2">
        <QuotaTooltip content={hint}>
          <Badge
            tabIndex={0}
            variant={
              state.kind === 'read-error'
                ? 'destructive'
                : state.kind === 'capability-absent'
                  ? 'unsupported'
                  : 'unknown'
            }
            className="max-w-full min-w-0"
          >
            <span className="truncate">{label}</span>
          </Badge>
        </QuotaTooltip>
        {onInspect && state.kind !== 'capability-absent' ? (
          <Button
            type="button"
            variant="text"
            size="xs"
            className="cursor-pointer"
            onClick={onInspect}
            aria-label={t('upstreamPage.quota.summary.viewDetails')}
          >
            {t('upstreamPage.quota.summary.viewDetailsShort')}
            <ChevronRight aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    )
  }
  const { entry, readFailed } = state
  const display = resolveQuotaSnapshotDisplay(entry)
  const unsupported = entry.status === 'unsupported' || entry.collectionStatus === 'unsupported'
  const total = Math.max(entry.windowCount, entry.windows.length, entry.primaryWindows.length)
  const grid = entry.provider.trim().toLowerCase() === 'xai' ? null : buildQuotaPreviewGrid(entry)
  const shownWindows = grid
    ? grid.groups
        .flatMap((group) => group.values)
        .filter((window): window is QuotaWindow => window !== null)
    : entry.provider.trim().toLowerCase() === 'xai'
      ? [findXaiWeeklyWindow(entry), findCurrencyWindow(entry), findXaiOnDemandWindow(entry)]
          .filter((window): window is QuotaWindow => window !== null)
          .slice(0, 2)
      : (entry.primaryWindows.length ? entry.primaryWindows : entry.windows).slice(0, 2)
  const hiddenRisk =
    entry.status === 'exhausted' && !shownWindows.some((window) => window.status === 'exhausted')
      ? 'exhausted'
      : entry.status === 'low' &&
          !shownWindows.some((window) => window.status === 'low' || window.status === 'exhausted')
        ? 'low'
        : null
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1.5 wrap-anywhere whitespace-normal">
      <QuotaSnapshotBadges
        entry={entry}
        collecting={collecting}
        readFailed={readFailed}
        unavailableReason={unavailableReason}
      />
      {!unsupported && display.hasWindows ? <QuotaPreview entry={entry} /> : null}
      {!unsupported ? (
        <QuotaFooter
          entry={entry}
          onInspect={onInspect}
          total={total}
          detailLoading={detailLoading}
          detailFailed={detailFailed}
          hiddenRisk={hiddenRisk}
        />
      ) : null}
    </div>
  )
}
