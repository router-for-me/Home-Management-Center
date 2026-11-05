import { AlertTriangle, ChevronRight, CircleHelp, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { OverflowTooltipText } from '@/components/shared/overflow-tooltip-text'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { formatUpstreamQuotaRelativeTime } from './quota-format'
import { getQuotaNextReset } from './quota-preview-model'
import { QuotaTooltip } from './quota-tooltip'
import { type UpstreamQuotaEntry, resolveQuotaSnapshotDisplay } from './upstream-quota-model'

const timeClassName =
  'text-muted-foreground text-meta block min-w-0 truncate rounded-sm outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]'

export function QuotaFooter({
  entry,
  onInspect,
  total,
  detailLoading,
  detailFailed,
  hiddenRisk,
}: {
  entry: UpstreamQuotaEntry
  onInspect?: () => void
  total: number
  detailLoading: boolean
  detailFailed: boolean
  hiddenRisk: 'low' | 'exhausted' | null
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const display = resolveQuotaSnapshotDisplay(entry)
  const absolute = (value: string | null) =>
    value && Number.isFinite(Date.parse(value))
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(
          new Date(value),
        )
      : t('upstreamPage.quota.common.notAvailable')
  const resetAt = getQuotaNextReset(entry)
  const resetTime = Date.parse(resetAt ?? '')
  const futureReset = Number.isFinite(resetTime) && resetTime > Date.now()
  const resetLabel = futureReset
    ? t('upstreamPage.quota.summary.nextReset', {
        time: formatUpstreamQuotaRelativeTime(resetTime, locale),
      })
    : t('upstreamPage.quota.summary.resetUnconfirmed')
  const resetHint = t(
    futureReset
      ? 'upstreamPage.quota.summary.resetHint'
      : resetAt
        ? 'upstreamPage.quota.summary.pastResetHint'
        : 'upstreamPage.quota.summary.resetUnknownHint',
    { time: absolute(resetAt) },
  )
  const observedTime = Date.parse(entry.observedAt ?? '')
  const observed = Number.isFinite(observedTime)
  const observedLabel = observed
    ? t('upstreamPage.quota.summary.observedAgo', {
        time: formatUpstreamQuotaRelativeTime(observedTime, locale),
      })
    : t(
        display.hasWindows
          ? 'upstreamPage.quota.summary.observedUnknown'
          : entry.lastAttemptAt
            ? 'upstreamPage.quota.summary.noCollectionResult'
            : 'upstreamPage.quota.summary.notYetCollected',
      )
  const observedHint = observed
    ? t('upstreamPage.quota.summary.observedAtHint', { time: absolute(entry.observedAt) })
    : !display.hasWindows && Number.isFinite(Date.parse(entry.lastAttemptAt ?? ''))
      ? t('upstreamPage.quota.summary.noCollectionResultHint', {
          time: absolute(entry.lastAttemptAt),
        })
      : null
  const detailsLabel =
    total > 0
      ? t('upstreamPage.quota.summary.viewAll', { count: total })
      : t('upstreamPage.quota.summary.viewDetails')
  const detailsNotice = detailFailed
    ? t('upstreamPage.quota.summary.detailReadFailed')
    : hiddenRisk
      ? t(`upstreamPage.quota.summary.hiddenRisk.${hiddenRisk}`)
      : null
  const detailsIcon = detailFailed ? (
    <CircleHelp aria-hidden="true" />
  ) : hiddenRisk ? (
    <AlertTriangle
      className={
        hiddenRisk === 'exhausted'
          ? 'text-destructive'
          : 'text-warning-foreground dark:text-warning'
      }
      aria-hidden="true"
    />
  ) : (
    <ChevronRight aria-hidden="true" />
  )
  const detailsButton = onInspect ? (
    <Button
      type="button"
      variant="text"
      size="xs"
      className="max-w-full min-w-0"
      onClick={onInspect}
      aria-busy={detailLoading || undefined}
      aria-label={detailsNotice ? `${detailsLabel}. ${detailsNotice}` : detailsLabel}
    >
      {t('upstreamPage.quota.summary.viewDetailsShort')}
      {detailLoading ? (
        <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        detailsIcon
      )}
    </Button>
  ) : null
  return (
    <div
      className={cn(
        'grid min-w-0 items-center gap-3',
        onInspect ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]' : 'grid-cols-2',
      )}
    >
      <QuotaTooltip content={resetHint}>
        <span tabIndex={0} className={timeClassName} aria-label={`${resetLabel}. ${resetHint}`}>
          {resetLabel}
        </span>
      </QuotaTooltip>
      {observedHint ? (
        <QuotaTooltip content={observedHint}>
          {observed ? (
            <time
              tabIndex={0}
              dateTime={entry.observedAt ?? undefined}
              className={timeClassName}
              aria-label={`${observedLabel}. ${observedHint}`}
            >
              {observedLabel}
            </time>
          ) : (
            <span tabIndex={0} className={timeClassName}>
              {observedLabel}
            </span>
          )}
        </QuotaTooltip>
      ) : (
        <OverflowTooltipText value={observedLabel} className="text-muted-foreground text-meta" />
      )}
      {detailsNotice && detailsButton ? (
        <QuotaTooltip content={detailsNotice}>{detailsButton}</QuotaTooltip>
      ) : (
        detailsButton
      )}
    </div>
  )
}
