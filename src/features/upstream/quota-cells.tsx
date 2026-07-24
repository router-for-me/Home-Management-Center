import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import {
  getUpstreamQuotaWindowDisplayLabel,
  getUpstreamQuotaWindowIdentityLabel,
} from '@/features/upstream/quota-format'
import type {
  QuotaCollectionStatus,
  QuotaPlan,
  QuotaStatus,
  QuotaWindow,
} from '@/lib/api/management/quota'
import { cn } from '@/lib/utils'

import {
  type UpstreamQuotaCellState,
  type UpstreamQuotaEntry,
  findCurrencyWindow,
  findXaiOnDemandWindow,
  resolveAntigravityQuotaPresentation,
} from './upstream-quota-model'

const upstreamQuotaStatusClassNames: Record<QuotaStatus, string> = {
  healthy: 'border-success/30 bg-success/10 text-success',
  low: 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning',
  exhausted: 'border-destructive/30 bg-destructive/10 text-destructive',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  unknown: 'border-border bg-muted/50 text-muted-foreground',
  unsupported: 'border-info/25 bg-info/10 text-info',
}

const upstreamQuotaProgressClassNames: Record<QuotaStatus, string> = {
  healthy: 'bg-success',
  low: 'bg-warning',
  exhausted: 'bg-destructive',
  error: 'bg-destructive',
  unknown: 'bg-muted-foreground/40',
  unsupported: 'bg-info/60',
}

export function UpstreamQuotaStatusBadge({ status }: { status: QuotaStatus }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
        upstreamQuotaStatusClassNames[status],
      )}
    >
      {t(`upstreamPage.quota.status.${status}`)}
    </span>
  )
}

export function UpstreamQuotaMetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-muted/50 text-muted-foreground inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium">
      {children}
    </span>
  )
}

function UpstreamQuotaCollectionBadge({ status }: { status: QuotaCollectionStatus }) {
  const { t } = useTranslation()
  if (status !== 'partial' && status !== 'failed') return null

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
        status === 'failed'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning',
      )}
    >
      {t(`upstreamPage.quota.collection.${status}`)}
    </span>
  )
}

export function UpstreamQuotaPlanBadge({ plan }: { plan: QuotaPlan }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold',
        plan.premium
          ? 'border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning'
          : 'bg-foreground text-background border-transparent',
      )}
    >
      {plan.name}
    </span>
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

export function InlineWindowBar({ window, label }: { window: QuotaWindow; label?: string }) {
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
    <div className="grid min-w-0 gap-1">
      <div className="grid grid-cols-[minmax(6.5rem,9rem)_minmax(2.5rem,1fr)_2.25rem] items-center gap-2">
        <span className="min-w-0 text-[11px] font-medium" title={ariaLabel}>
          <span className={cn('block truncate', !identityLabel && 'text-muted-foreground')}>
            {displayLabel}
          </span>
          {identityLabel ? (
            <span className="text-muted-foreground block truncate text-[10px]">{periodLabel}</span>
          ) : null}
        </span>
        <div
          className="bg-muted h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-label={ariaLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage ?? 0}
        >
          {percentage === null ? null : (
            <div
              className={cn('h-full rounded-full', upstreamQuotaProgressClassNames[window.status])}
              style={{ width: `${percentage}%` }}
            />
          )}
        </div>
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
    <p className="text-muted-foreground truncate pl-14 text-[11px] tabular-nums">
      {t('upstreamPage.quota.moneyRemaining', { remaining, limit })}
    </p>
  )
}

function GenericWindowsCell({ entry }: { entry: UpstreamQuotaEntry }) {
  const { t } = useTranslation()
  const windows = entry.primaryWindows.length > 0 ? entry.primaryWindows : entry.windows.slice(0, 2)
  const shown = windows.slice(0, 2)
  const additionalCount = Math.max(0, entry.windowCount - shown.length)

  if (shown.length === 0) {
    return (
      <span className="text-muted-foreground text-xs">{t('upstreamPage.quota.noWindows')}</span>
    )
  }

  return (
    <div className="grid min-w-52 gap-1.5">
      {shown.map((window) => (
        <InlineWindowBar key={window.id} window={window} />
      ))}
      {additionalCount > 0 ? (
        <p className="text-muted-foreground text-[11px]">
          {t('upstreamPage.quota.more', { count: additionalCount })}
        </p>
      ) : null}
    </div>
  )
}

function AntigravityWindowRow({
  groupId,
  window,
}: {
  groupId: 'gemini' | 'third-party'
  window: QuotaWindow
}) {
  const { t, i18n } = useTranslation()
  const percentage = window.remainingRatio === null ? null : Math.round(window.remainingRatio * 100)
  const periodLabel = getUpstreamQuotaWindowDisplayLabel(
    window,
    t,
    i18n.resolvedLanguage ?? i18n.language,
  )
  const groupLabel = t(
    `upstreamPage.quota.antigravity.${groupId === 'gemini' ? 'gemini' : 'thirdParty'}`,
  )

  return (
    <div className="grid grid-cols-[minmax(6.5rem,9rem)_minmax(2.5rem,1fr)_2.25rem] items-center gap-2">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium">{groupLabel}</p>
        <p className="text-muted-foreground truncate text-[10px]">{periodLabel}</p>
      </div>
      <div
        className="bg-muted h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-label={`${groupLabel}, ${periodLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage ?? 0}
      >
        {percentage === null ? null : (
          <div
            className={cn('h-full rounded-full', upstreamQuotaProgressClassNames[window.status])}
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
      <span className="text-muted-foreground text-right text-[11px] tabular-nums">
        {percentage === null ? '—' : `${percentage}%`}
      </span>
    </div>
  )
}

function AntigravityQuotaCell({ entry }: { entry: UpstreamQuotaEntry }) {
  const { t } = useTranslation()
  const presentation = resolveAntigravityQuotaPresentation(entry, [
    ...entry.primaryWindows,
    ...entry.windows,
  ])

  if (presentation.kind === 'not-collected') {
    return (
      <span className="border-border bg-muted text-muted-foreground inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium">
        {t('upstreamPage.quota.notCollected')}
      </span>
    )
  }

  if (presentation.kind === 'failed') {
    return (
      <div className="grid min-w-40 gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <UpstreamQuotaStatusBadge status="error" />
          <UpstreamQuotaMetaBadge>
            {t(`upstreamPage.quota.freshness.${entry.freshness}`)}
          </UpstreamQuotaMetaBadge>
          <UpstreamQuotaCollectionBadge status="failed" />
        </div>
        <p className="text-destructive line-clamp-2 text-[11px] leading-4">
          {entry.lastError?.message ?? t('upstreamPage.quota.collectFailed')}
        </p>
      </div>
    )
  }

  if (presentation.kind === 'collecting' || presentation.kind === 'legacy') {
    return (
      <div className="grid min-w-52 gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <UpstreamQuotaStatusBadge status="unknown" />
          <UpstreamQuotaMetaBadge>
            {t(
              presentation.kind === 'collecting'
                ? 'upstreamPage.quota.collection.collecting'
                : 'upstreamPage.quota.freshness.stale',
            )}
          </UpstreamQuotaMetaBadge>
          <UpstreamQuotaCollectionBadge status={entry.collectionStatus} />
        </div>
        <p className="text-muted-foreground text-[11px] leading-4">
          {t(
            presentation.kind === 'collecting'
              ? 'upstreamPage.quota.antigravity.upgrading'
              : 'upstreamPage.quota.antigravity.legacy',
          )}
        </p>
      </div>
    )
  }

  const additionalCount = Math.max(0, Math.min(entry.windowCount, 4) - presentation.groups.length)

  return (
    <div className="grid min-w-52 gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {entry.plan ? <UpstreamQuotaPlanBadge plan={entry.plan} /> : null}
        <UpstreamQuotaStatusBadge status={entry.status} />
        <UpstreamQuotaMetaBadge>
          {t(`upstreamPage.quota.freshness.${entry.freshness}`)}
        </UpstreamQuotaMetaBadge>
        <UpstreamQuotaCollectionBadge status={entry.collectionStatus} />
      </div>
      <div className="grid gap-1.5">
        {presentation.groups.map((group) => {
          const window = group.windows[0]
          return window ? (
            <AntigravityWindowRow key={group.id} groupId={group.id} window={window} />
          ) : null
        })}
      </div>
      {additionalCount > 0 ? (
        <p className="text-muted-foreground text-[11px]">
          {t('upstreamPage.quota.more', { count: additionalCount })}
        </p>
      ) : null}
    </div>
  )
}

function GrokQuotaCell({ entry }: { entry: UpstreamQuotaEntry }) {
  const { t } = useTranslation()
  const monthlyWindow = findCurrencyWindow(entry)
  const onDemandWindow = findXaiOnDemandWindow(entry)

  return (
    <div className="grid min-w-44 gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {entry.plan ? <UpstreamQuotaPlanBadge plan={entry.plan} /> : null}
        <UpstreamQuotaStatusBadge status={entry.status} />
        <UpstreamQuotaMetaBadge>
          {t(`upstreamPage.quota.freshness.${entry.freshness}`)}
        </UpstreamQuotaMetaBadge>
        <UpstreamQuotaCollectionBadge status={entry.collectionStatus} />
      </div>
      {monthlyWindow ? (
        <>
          <InlineWindowBar window={monthlyWindow} label={t('upstreamPage.quota.monthly')} />
          <InlineWindowMoneyLine window={monthlyWindow} />
        </>
      ) : (
        <GenericWindowsCell entry={entry} />
      )}
      {onDemandWindow ? (
        <>
          <InlineWindowBar window={onDemandWindow} label={t('upstreamPage.quota.onDemand')} />
          <InlineWindowMoneyLine window={onDemandWindow} />
        </>
      ) : null}
    </div>
  )
}

function UpstreamQuotaEntryCell({ entry }: { entry: UpstreamQuotaEntry }) {
  const { t } = useTranslation()
  const provider = entry.provider.trim().toLowerCase()

  if (entry.status === 'unsupported') {
    return (
      <div className="grid min-w-40 gap-1">
        <UpstreamQuotaStatusBadge status="unsupported" />
        <p className="text-muted-foreground text-[11px] leading-4">
          {t('upstreamPage.quota.unsupportedHint')}
        </p>
      </div>
    )
  }

  if (provider === 'antigravity') {
    return <AntigravityQuotaCell entry={entry} />
  }

  if (entry.status === 'error') {
    return (
      <div className="grid min-w-40 gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <UpstreamQuotaStatusBadge status="error" />
          <UpstreamQuotaMetaBadge>
            {t(`upstreamPage.quota.freshness.${entry.freshness}`)}
          </UpstreamQuotaMetaBadge>
          <UpstreamQuotaCollectionBadge status={entry.collectionStatus} />
        </div>
        <p className="text-destructive line-clamp-2 text-[11px] leading-4">
          {entry.lastError?.message ?? t('upstreamPage.quota.collectFailed')}
        </p>
      </div>
    )
  }

  if (provider === 'xai') {
    return <GrokQuotaCell entry={entry} />
  }

  return (
    <div className="grid min-w-52 gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {entry.plan ? <UpstreamQuotaPlanBadge plan={entry.plan} /> : null}
        <UpstreamQuotaStatusBadge status={entry.status} />
        <UpstreamQuotaMetaBadge>
          {t(`upstreamPage.quota.freshness.${entry.freshness}`)}
        </UpstreamQuotaMetaBadge>
        <UpstreamQuotaCollectionBadge status={entry.collectionStatus} />
      </div>
      <GenericWindowsCell entry={entry} />
    </div>
  )
}

export function UpstreamQuotaCell({ state }: { state: UpstreamQuotaCellState }) {
  const { t } = useTranslation()

  if (state.kind === 'capability-absent') {
    return (
      <span className="text-muted-foreground text-xs">{t('upstreamPage.quota.unsupported')}</span>
    )
  }

  if (state.kind === 'loading') {
    return <Skeleton className="h-8 w-40 rounded-md" />
  }

  if (state.kind === 'not-collected') {
    return (
      <span className="border-border bg-muted text-muted-foreground inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium">
        {t('upstreamPage.quota.notCollected')}
      </span>
    )
  }

  return <UpstreamQuotaEntryCell entry={state.entry} />
}
